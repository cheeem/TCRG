#include <linux/bpf.h>
#include <linux/if_ether.h>
#include <linux/ip.h>
#include <linux/udp.h>
#include <linux/in.h> 

#include <bpf/bpf_helpers.h>
#include <bpf/bpf_endian.h>

// TODO: include connection port from a central .h file
#define PORT 9090
#define RX_QUEUE_CAP 64

struct {
  __uint(type, BPF_MAP_TYPE_XSKMAP);
  __uint(max_entries, RX_QUEUE_CAP);
  __type(key, __u32);
  __type(value, __u32);
} xsks_map SEC(".maps");

SEC("xdp")
int xdp_filter(struct xdp_md *ctx) {
  void* data = (void*)(long)ctx->data;
  void* data_end = (void*)(long)ctx->data_end;

  struct ethhdr *eth = data;
  if((void*)(eth+1) > data_end) return XDP_PASS;
  if(eth->h_proto != bpf_htons(ETH_P_IP)) return XDP_PASS;

  struct iphdr *ip = (void*)(eth+1);
  if((void*)(ip+1) > data_end) return XDP_PASS;
  if(ip->version != 4 || ip->protocol != IPPROTO_UDP) return XDP_PASS;

  __u32 ip_len = ip->ihl * 4;
  if(ip->ihl < 5) return XDP_PASS;
  if((void*)ip + ip_len > data_end) return XDP_PASS;

  __u16 frag_offset = bpf_ntohs(ip->frag_off);
  if(frag & (IP_MF | IP_OFFSET)) return XDP_PASS;

  __u16 ip_total_len = bpf_ntohs(ip->tot_len);
  if(ip_total_len < ip_len + sizeof(struct udphdr)) return XDP_PASS;
  if((void*)ip + ip_total_len > data_end) return XDP_PASS;

  struct udphdr *udp = (void*)((char*)ip + ip_len);
  if((void*)(udp + 1) > data_end) return XDP_PASS;
  if(udp->dest != bpf_htons(PORT)) return XDP_PASS;

  __u16 udp_len = bpf_ntohs(udp->len);
  if(udp_len != ip_total_len - ip_len) return XDP_PASS;

  __u32 queue_id = ctx->rx_queue_index;
  if(queue_id >= RX_QUEUE_CAP) return XDP_DROP;

  return bpf_redirect_map(&xsks_map, queue_id, XDP_DROP);
}

char _license[] SEC("license") = "GPL";


