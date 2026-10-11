//! Bounded, deadline-controlled child transport. Never logs requests or provider output.
use serde_json::{json, Value};
use std::{
    io::{BufRead, BufReader, Read, Write},
    path::Path,
    process::{Child, Command, Stdio},
    sync::{
        mpsc::{self, Receiver, SyncSender},
        Arc, Mutex,
    },
    time::Duration,
};
pub type Reply<T> = Result<T, &'static str>;
type Control = Arc<Mutex<Child>>;
fn stop(child: &Control) {
    if let Ok(mut child) = child.lock() {
        let _ = child.kill();
        let _ = child.wait();
    }
}
struct Process {
    child: Control,
    input: SyncSender<Value>,
    output: Receiver<Reply<Value>>,
    sequence: u32,
}
impl Process {
    fn spawn(command: &mut Command) -> Reply<Self> {
        let mut child = command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|_| "unavailable")?;
        let stdin = child.stdin.take().ok_or("unavailable")?;
        let stdout = child.stdout.take().ok_or("unavailable")?;
        let child = Arc::new(Mutex::new(child));
        let (input, requests) = mpsc::sync_channel::<Value>(1);
        let (responses, output) = mpsc::sync_channel(1);
        std::thread::spawn(move || {
            let mut stdin = stdin;
            let mut stdout = BufReader::new(stdout);
            for request in requests {
                let result = (|| -> Reply<Value> {
                    let mut bytes = serde_json::to_vec(&request).map_err(|_| "protocol")?;
                    if bytes.len() > 16383 {
                        return Err("protocol");
                    }
                    bytes.push(b'\n');
                    stdin
                        .write_all(&bytes)
                        .and_then(|_| stdin.flush())
                        .map_err(|_| "unavailable")?;
                    let mut frame = Vec::new();
                    stdout
                        .by_ref()
                        .take(2_000_001)
                        .read_until(b'\n', &mut frame)
                        .map_err(|_| "unavailable")?;
                    if frame.len() > 2_000_000 || !frame.ends_with(b"\n") {
                        return Err("protocol");
                    }
                    serde_json::from_slice(&frame).map_err(|_| "protocol")
                })();
                let failed = result.is_err();
                if responses.send(result).is_err() || failed {
                    break;
                }
            }
        });
        Ok(Self {
            child,
            input,
            output,
            sequence: 0,
        })
    }
    fn request(&mut self, model: usize, ids: Option<&[i64]>, timeout: Duration) -> Reply<Value> {
        self.sequence = self.sequence.checked_add(1).ok_or("protocol")?;
        let mut request = json!({"id": self.sequence, "model": model});
        if let Some(ids) = ids {
            request["input_ids"] = json!(ids);
        }
        self.input.try_send(request).map_err(|_| "unavailable")?;
        let response = self.output.recv_timeout(timeout).map_err(|_| "timeout")??;
        if response.get("id").and_then(Value::as_u64) != Some(u64::from(self.sequence))
            || response.get("error").is_some()
        {
            return Err("protocol");
        }
        response.get("result").cloned().ok_or("protocol")
    }
}
impl Drop for Process {
    fn drop(&mut self) {
        stop(&self.child);
    }
}
#[derive(Default)]
struct Slot {
    closed: bool,
    epoch: u32,
    /// Models the loaded child serves; requests outside this range never reach it.
    models: usize,
    process: Option<Process>,
    active: Option<Control>,
}
impl Slot {
    fn clear(&mut self) {
        self.process = None;
        if let Some(child) = self.active.take() {
            stop(&child);
        }
    }
}
impl Drop for Slot {
    fn drop(&mut self) {
        self.clear();
    }
}
#[derive(Clone, Default)]
pub struct Supervisor {
    slot: Arc<Mutex<Slot>>,
}
impl Supervisor {
    /// Start the helper and prepare `models` sessions, one per pack model in order.
    pub fn load(
        &self,
        executable: &Path,
        library: &Path,
        root: &Path,
        models: usize,
    ) -> Reply<(u32, Vec<Value>)> {
        self.load_command(
            Command::new(executable).arg(library).arg(root).arg("4"),
            models,
            Duration::from_secs(120),
        )
    }
    fn load_command(
        &self,
        command: &mut Command,
        models: usize,
        timeout: Duration,
    ) -> Reply<(u32, Vec<Value>)> {
        if models == 0 {
            return Err("input");
        }
        let epoch = {
            let mut slot = self.slot.lock().map_err(|_| "unavailable")?;
            if slot.closed {
                return Err("closed");
            }
            slot.clear();
            slot.epoch = slot.epoch.checked_add(1).ok_or("unavailable")?;
            slot.models = models;
            slot.process = Some(Process::spawn(command)?);
            slot.epoch
        };
        let values = self.with_process(epoch, |process| {
            (0..models)
                .map(|model| process.request(model, None, timeout))
                .collect()
        })?;
        Ok((epoch, values))
    }
    fn with_process<T>(&self, epoch: u32, call: impl FnOnce(&mut Process) -> Reply<T>) -> Reply<T> {
        let mut process = {
            let mut slot = self.slot.lock().map_err(|_| "unavailable")?;
            if slot.closed || slot.epoch != epoch {
                return Err("stale");
            }
            if slot.active.is_some() {
                return Err("busy");
            }
            let process = slot.process.take().ok_or("not_ready")?;
            slot.active = Some(Arc::clone(&process.child));
            process
        };
        let result = call(&mut process);
        let mut slot = self.slot.lock().map_err(|_| "unavailable")?;
        if slot.closed || slot.epoch != epoch {
            return Err("stale");
        }
        slot.active = None;
        if result.is_ok() {
            slot.process = Some(process);
        }
        result
    }
    pub fn run(&self, epoch: u32, model: usize, ids: &[i64]) -> Reply<Value> {
        if !(2..=384).contains(&ids.len()) || ids.iter().any(|id| *id < 0) {
            return Err("input");
        }
        {
            let slot = self.slot.lock().map_err(|_| "unavailable")?;
            if slot.epoch == epoch && model >= slot.models {
                return Err("input");
            }
        }
        self.with_process(epoch, |process| {
            process.request(model, Some(ids), Duration::from_secs(15))
        })
    }
    pub fn shutdown(&self) {
        if let Ok(mut slot) = self.slot.lock() {
            slot.closed = true;
            slot.clear();
        }
    }
    pub fn release(&self, epoch: u32) -> Reply<()> {
        let mut slot = self.slot.lock().map_err(|_| "unavailable")?;
        if slot.epoch == epoch {
            slot.epoch = slot.epoch.checked_add(1).ok_or("unavailable")?;
            slot.clear();
        }
        Ok(())
    }
}
#[cfg(all(test, unix))]
mod tests {
    use super::*;
    fn fake(mode: &str) -> Command {
        let mut command = Command::new("python3");
        command
            .arg("-u")
            .arg("-c")
            .arg(
                r#"
import sys,json,time,os
mode=sys.argv[1]
for line in sys.stdin:
 r=json.loads(line)
 if mode=='exit': os._exit(3)
 if mode=='hang': time.sleep(120)
 if mode=='bad': print('x'*2000001,flush=True); continue
 print(json.dumps({'id':r['id']+(1 if mode=='stale' else 0),'result':{'ready':True}}),flush=True)
"#,
            )
            .arg(mode);
        command
    }
    #[test]
    fn crash_timeout_and_invalid_frames_allow_fresh_load() {
        let supervisor = Supervisor::default();
        for mode in ["exit", "hang", "bad", "stale"] {
            assert!(supervisor
                .load_command(&mut fake(mode), 2, Duration::from_millis(200))
                .is_err());
            let (epoch, values) = supervisor
                .load_command(&mut fake("ok"), 2, Duration::from_secs(2))
                .unwrap();
            assert_eq!(values.len(), 2);
            assert!(supervisor.run(epoch, 0, &[1, 2]).is_ok());
            assert!(supervisor.run(epoch, 1, &[1, 2]).is_ok());
            assert_eq!(supervisor.run(epoch, 2, &[1, 2]), Err("input"));
            supervisor.release(epoch).unwrap();
        }
    }
    #[test]
    fn old_release_and_requests_cannot_affect_replacement() {
        let supervisor = Supervisor::default();
        let (old, _) = supervisor
            .load_command(&mut fake("ok"), 1, Duration::from_secs(2))
            .unwrap();
        let (new, _) = supervisor
            .load_command(&mut fake("ok"), 1, Duration::from_secs(2))
            .unwrap();
        supervisor.release(old).unwrap();
        assert!(supervisor.run(old, 0, &[1, 2]).is_err());
        assert!(supervisor.run(new, 0, &[1, 2]).is_ok());
        supervisor.release(new).unwrap();
    }
    #[test]
    fn release_and_shutdown_interrupt_an_active_loading_child() {
        for shutdown in [false, true] {
            let supervisor = Supervisor::default();
            let background = supervisor.clone();
            let thread = std::thread::spawn(move || {
                background.load_command(&mut fake("hang"), 1, Duration::from_secs(120))
            });
            let deadline = std::time::Instant::now() + Duration::from_secs(2);
            let (epoch, child) = loop {
                let slot = supervisor.slot.lock().unwrap();
                if let Some(child) = &slot.active {
                    break (slot.epoch, Arc::clone(child));
                }
                drop(slot);
                assert!(std::time::Instant::now() < deadline);
                std::thread::sleep(Duration::from_millis(5));
            };
            if shutdown {
                supervisor.shutdown();
                assert!(supervisor
                    .load_command(&mut fake("ok"), 1, Duration::from_secs(2))
                    .is_err());
            }
            supervisor.release(epoch).unwrap();
            assert!(thread.join().unwrap().is_err());
            assert!(child.lock().unwrap().try_wait().unwrap().is_some());
        }
    }
}
