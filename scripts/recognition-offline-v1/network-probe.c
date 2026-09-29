// Developer-only launcher: prove IP denial before exec'ing the unchanged QA host.
// Loopback probes contain no documents, names, tokens or model data.
#include <arpa/inet.h>
#include <errno.h>
#include <stdio.h>
#include <sys/socket.h>
#include <unistd.h>
static int probe(int family, int type) {
  int fd = socket(family, type, 0);
  if (fd < 0) return errno == EPERM;
  struct sockaddr_storage storage = {0};
  socklen_t len;
  if (family == AF_INET) {
    struct sockaddr_in *a = (struct sockaddr_in *)&storage;
    a->sin_family = AF_INET; a->sin_port = htons(9);
    inet_pton(AF_INET, "127.0.0.1", &a->sin_addr); len = sizeof(*a);
  } else {
    struct sockaddr_in6 *a = (struct sockaddr_in6 *)&storage;
    a->sin6_family = AF_INET6; a->sin6_port = htons(9);
    inet_pton(AF_INET6, "::1", &a->sin6_addr); len = sizeof(*a);
  }
  int result = connect(fd, (struct sockaddr *)&storage, len);
  int denied = result == -1 && errno == EPERM;
  close(fd); return denied;
}
int main(int argc, char **argv) {
  if (argc != 3) return 2;
  int a = probe(AF_INET, SOCK_STREAM), b = probe(AF_INET6, SOCK_STREAM);
  int c = probe(AF_INET, SOCK_DGRAM), d = probe(AF_INET6, SOCK_DGRAM);
  FILE *out = fopen(argv[2], "w");
  if (!out) return 3;
  fprintf(out, "{\"pid\":%d,\"ipv4TcpDenied\":%s,\"ipv6TcpDenied\":%s,\"ipv4UdpDenied\":%s,\"ipv6UdpDenied\":%s}\n", getpid(), a?"true":"false",b?"true":"false",c?"true":"false",d?"true":"false");
  fclose(out);
  if (!(a && b && c && d)) return 4;
  execl(argv[1], argv[1], (char *)NULL); return 5;
}
