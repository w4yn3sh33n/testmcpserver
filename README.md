# Greeting & Image Generation MCP Server

다국어 인사 및 AI 이미지 생성을 지원하는 MCP (Model Context Protocol) 서버입니다.

## 기능

### 1. 다국어 인사 (`greeting`)
- 영어, 한국어, 일본어로 인사말 생성
- 매개변수:
  - `name`: 인사할 사람의 이름 (필수)
  - `language`: 언어 선택 (`en`, `ko`, `ja` 중 선택, 기본값: `en`)

### 2. AI 이미지 생성 (`generate_image`)
- FLUX.1-schnell 모델을 사용한 AI 이미지 생성
- 매개변수:
  - `prompt`: 이미지 생성을 위한 프롬프트 설명 (필수)
- 결과: base64 인코딩된 PNG 이미지

## 설치 및 설정

1. 의존성 설치:
```bash
npm install
```

2. 환경변수 설정:
```bash
export HF_TOKEN="your_huggingface_token_here"
```

3. 빌드:
```bash
npm run build
```

## 사용법

### MCP 클라이언트에서 사용

#### 1. 인사 도구 사용
```json
{
  "tool": "greeting",
  "parameters": {
    "name": "Alice",
    "language": "en"
  }
}
```

결과:
```json
{
  "content": [
    {
      "type": "text",
      "text": "Hello, Alice! Nice to meet you! 👋"
    }
  ]
}
```

#### 2. 이미지 생성 도구 사용
```json
{
  "tool": "generate_image",
  "parameters": {
    "prompt": "Astronaut riding a horse"
  }
}
```

결과:
```json
{
  "content": [
    {
      "type": "image",
      "data": "base64-encoded-data",
      "mimeType": "image/png"
    }
  ],
  "annotations": {
    "audience": ["user"],
    "priority": 0.9
  }
}
```

## 리소스

### 서버 정보
- `server://info`: 기본 서버 정보
- `server://detailed-info`: 상세한 서버 기능 및 상태 정보

## 프롬프트

### 코드 리뷰
- `code_review`: 종합적인 코드 리뷰 프롬프트 템플릿

## 환경변수

- `HF_TOKEN`: Hugging Face API 토큰 (이미지 생성 기능에 필요)

## 기술 스택

- TypeScript
- @modelcontextprotocol/sdk
- @huggingface/inference
- Zod (스키마 검증)

## 라이선스

ISC