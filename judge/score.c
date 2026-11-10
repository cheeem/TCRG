#include <stdint.h>

#if defined(__AVX512F__) || defined(__AVX2__) || defined(__AVX__)
  #include <immintrin.h>
#elif defined(__SSE2__)
  #include <emmintrin.h>
  #include <xmmintrin.h>
#endif

// packet
// 32 generation
// 16 node index
// 16 length

static float dot(const float* restrict v1, const float* restrict v2, size_t len) {
  size_t subset_len, i = 0;
  float tmp, product = 0.0f;

  #if defined(__AVX512F__)
    __m512 product_16_0 = _mm512_setzero_ps();
    subset_len = len & ~(size_t)15;
    for(; i < subset_len; i += 16) {
      __m512 vt1;
      __m512 vt2;

      vt1 = _mm512_loadu_ps(v1 + i);
      vt2 = _mm512_loadu_ps(v2 + i);
      product_16_0 = _mm512_fmadd_ps(vt1, vt2, product_16_0);
    }
    product += _mm512_reduce_add_ps(product_16_0);
  #elif defined(__AVX__)
    __m256 product_8_0 = _mm256_setzero_ps();
    subset_len = len & ~(size_t)7;
    for(; i < subset_len; i += 8) {
      __m256 vt1;
      __m256 vt2;

      vt1 = _mm256_loadu_ps(v1 + i);
      vt2 = _mm256_loadu_ps(v2 + i);
      #if defined(__FMA__)
        product_8_0 = _mm256_fmadd_ps(vt1, vt2, product_8_0);
      #else
        product_8_0 = _mm256_add_ps(product_8_0, _mm256_mul_ps(vt1, vt2));
      #endif
    }
    __m128 product_4_bot = _mm256_castps256_ps128(product_8_0);
    __m128 product_4_top = _mm256_extractf128_ps(product_8_0, 1);
    __m128 product_4 = _mm_add_ps(product_4_bot, product_4_top);
    __m128 product_2 = _mm_add_ps(product_4, _mm_movehl_ps(product_4, product_4));
    product_2 = _mm_add_ss(product_2, _mm_shuffle_ps(product_2, product_2, _MM_SHUFFLE(1, 1, 1, 1)));
    _mm_store_ss(&tmp, product_2);
    product += tmp;
  #elif defined(__SSE2__)
    __m128 product_4_0 = _mm_setzero_ps();
    subset_len = len & ~(size_t)3;
    for(; i < subset_len; i += 4) {
      __m128 vt1;
      __m128 vt2;

      vt1 = _mm_loadu_ps(v1 + i);
      vt2 = _mm_loadu_ps(v2 + i);
      product_4_0 = _mm_add_ps(product_4_0, _mm_mul_ps(vt1, vt2));
    }
    __m128 product_2 = _mm_add_ps(product_4_0, _mm_movehl_ps(product_4_0, product_4_0));
    product_2 = _mm_add_ss(product_2, _mm_shuffle_ps(product_2, product_2, _MM_SHUFFLE(1, 1, 1, 1)));
    _mm_store_ss(&tmp, product_2);
    product += tmp;
  #endif

  for(; i < len; i++) {
    product += v1[i] * v2[i];
  }

  return product;
}

float score(const float* restrict payload, const float* restrict config, size_t len) {
  return dot(payload, config, len);
}
