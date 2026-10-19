/** Diagnostic request-local cache. Never survives completion or cancellation. */
export async function* cachedWindows(text, encode, stats) {
  const boundaries=[];
  for(const {index} of new Intl.Segmenter('vi',{granularity:'grapheme'}).segment(text))boundaries.push(index);
  boundaries.push(text.length);
  function boundaryAt(offset,up) {
    let low=0,high=boundaries.length-1;
    while(low<high){const mid=Math.floor((low+high)/2);if(boundaries[mid]<offset)low=mid+1;else high=mid;}
    return boundaries[!up&&boundaries[low]>offset?low-1:low];
  }
  const cache=new Map();
  async function encoded(start,end) {
    const key=`${start}:${end}`;
    if(cache.has(key)){stats.hits++;return cache.get(key);}
    stats.calls++;
    const value=await encode(text.slice(start,end));
    cache.set(key,value);
    if(cache.size>16)cache.delete(cache.keys().next().value);
    stats.peak=Math.max(stats.peak,cache.size);
    return value;
  }
  try {
    let start=0;
    while(start<text.length) {
      let end=Math.min(start+1200,text.length);
      if((await encoded(start,end)).ids.length>384) {
        let low=start+1,high=end;
        while(low<high){const mid=Math.ceil((low+high)/2);if((await encoded(start,mid)).ids.length<=384)low=mid;else high=mid-1;}end=low;
      }
      if(end<text.length){const at=text.lastIndexOf(' ',end);if(at>start+(end-start)/2)end=at;}
      end=boundaryAt(end,false);
      if(end<=start)throw Error('Unbounded window');
      const encoding=await encoded(start,end);
      if(encoding.ids.length>384)throw Error('Token budget');
      yield {start,text:text.slice(start,end),encoding};
      if(end===text.length)break;
      let next=Math.max(start+1,end-96);const at=text.indexOf(' ',next);if(at>=0&&at<end-32)next=at+1;
      start=boundaryAt(next,true);
    }
  } finally {cache.clear();}
}
