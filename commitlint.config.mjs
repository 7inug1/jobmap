// Conventional Commits 1.0.0 (https://www.conventionalcommits.org/ko/v1.0.0/)
// 제목은 한국어 명사형 한 줄이라 대소문자 규칙은 적용하지 않는다.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [0],
  },
};
