// clang --target=wasm32 -nostdlib -Wl,--no-entry -Wl,--export-all -o tcrg.wasm tcrg.c
// look ma, no libs

typedef signed char         i8;
typedef signed short        i16;
typedef signed int          i32;
typedef signed long long    i64;

typedef unsigned char       u8;
typedef unsigned short      u16;
typedef unsigned int        u32;
typedef unsigned long long  u64;

#define BUF_CAP 1024 // in bytes, must be a power of 2
#define WORD_BYTES sizeof(u64)
#define WORD_BITS (WORD_BYTES * 8)
#define NEBV_CAP (BUF_CAP / WORD_BYTES)
#define SEARCH_DEPTH 8

static u32 rand_seed = 123456789; // TODO: choose better default seed
static i32 node_idx = -1;
static u64 nebv[NEBV_CAP]; // node eligibility bit vector
static u32 nebv_len = 2;

// https://en.wikipedia.org/wiki/Xorshift
static inline u32 rand() {
  u32 x = rand_seed;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  rand_seed = x;
  return x;
}

static inline u64 node_is_eligible(i32 idx) {
  return (nebv[((idx) / WORD_BITS)] >> ((idx) & (WORD_BITS-1))) & 1;
}

static i32 select_node_random(int depth) {
  // could loop unroll this and use simd here
  // consider that ctzl might not be available with simd targeting wasm
  for(int iter = 0; iter < depth; iter++) {
    u32 nebv_idx = rand() & (nebv_len-1);
    u32 pivot = rand() & (WORD_BITS-1);
    // bvw = bit vector word
    u64 bvw = nebv[nebv_idx];
    if(bvw == 0) {
      continue;
    }
    // circular shift left about the pivot
    u64 bvw_rotated = (bvw << pivot) | (bvw >> ((WORD_BITS - pivot) & (WORD_BITS - 1)));
    i32 bvw_idx = (__builtin_ctzll(bvw_rotated) - pivot) & (WORD_BITS - 1);
    return (i32)nebv_idx * WORD_BITS + bvw_idx;
  }

  // no eligible node could be found
  return -1;
}

static inline i32 select_node(int depth) {
  return select_node_random(depth);
}

__attribute__((visibility("default")))
void tcrg_set_rand_seed(u32 seed) {
  rand_seed = seed;
}

__attribute__((visibility("default")))
void tcrg_on_nebv_set(u32 bytes) {
  if(nebv_len < bytes / WORD_BYTES) {
    nebv_len = bytes / WORD_BYTES; // divided by 4 or 8, should be power of 2
  }

  if(node_idx == -1) {
    node_idx = select_node(SEARCH_DEPTH);
  }

  if(node_idx != -1 && node_is_eligible(node_idx) == 0) {
    node_idx = select_node(SEARCH_DEPTH);
  }
}

__attribute__((visibility("default")))
void* tcrg_get_buf(void) {
  return (void*)nebv;
}

__attribute__((visibility("default")))
u32 trcg_get_buf_len(void) {
  return nebv_len * WORD_BYTES;
}

__attribute__((visibility("default")))
i32 tcrg_get_node_index(void) {
  return node_idx;
}
