import { config } from 'dotenv'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { InferenceClient } from '@huggingface/inference'

// 환경변수 로드 (Smithery 환경 호환)
config(); // 현재 작업 디렉토리의 .env

// Smithery 환경에서는 환경변수가 자동으로 설정될 수 있음

// 환경변수 확인
if (!process.env.HF_TOKEN) {
    console.error('Warning: HF_TOKEN environment variable is not set. Image generation will not work.')
}

// 서버 인스턴스 생성
const server = new McpServer({
    name: 'greeting-image-mcp-server',
    version: '1.0.0',
    capabilities: {
        tools: {},
        resources: {},
        prompts: {}
    }
})

// // 예시 도구: 인사하기
// server.tool(
//     'greeting',
//     {
//         name: z.string().describe('인사할 사람의 이름'),
//         language: z
//             .enum(['ko', 'en'])
//             .optional()
//             .default('ko')
//             .describe('인사 언어 (기본값: ko)')
//     },
//     async ({ name, language }) => {
//         const greeting =
//             language === 'ko'
//                 ? `안녕하세요, ${name}님! 😊`
//                 : `Hello, ${name}! 👋`

//         return {
//             content: [
//                 {
//                     type: 'text',
//                     text: greeting
//                 }
//             ]
//         }
//     }
// )

// // 예시 도구: 계산기
// server.tool(
//     'calculator',
//     {
//         operation: z
//             .enum(['add', 'subtract', 'multiply', 'divide'])
//             .describe('수행할 연산 (add, subtract, multiply, divide)'),
//         a: z.number().describe('첫 번째 숫자'),
//         b: z.number().describe('두 번째 숫자')
//     },
//     async ({ operation, a, b }) => {
//         // 연산 수행
//         let result: number
//         switch (operation) {
//             case 'add':
//                 result = a + b
//                 break
//             case 'subtract':
//                 result = a - b
//                 break
//             case 'multiply':
//                 result = a * b
//                 break
//             case 'divide':
//                 if (b === 0) throw new Error('0으로 나눌 수 없습니다')
//                 result = a / b
//                 break
//             default:
//                 throw new Error('지원하지 않는 연산입니다')
//         }

//         const operationSymbols = {
//             add: '+',
//             subtract: '-',
//             multiply: '×',
//             divide: '÷'
//         } as const

//         const operationSymbol =
//             operationSymbols[operation as keyof typeof operationSymbols]

//         return {
//             content: [
//                 {
//                     type: 'text',
//                     text: `${a} ${operationSymbol} ${b} = ${result}`
//                 }
//             ]
//         }
//     }
// )

// // 예시 도구: 시간 조회
// server.tool(
//     'get_time',
//     {
//         timeZone: z.string().describe('시간대')
//     },
//     async ({ timeZone }) => {
//         return {
//             content: [
//                 {
//                     type: 'text',
//                     text: new Date().toLocaleString('ko-KR', {
//                         timeZone
//                     })
//                 }
//             ]
//         }
//     }
// )

// 다국어 인사 도구
server.tool(
    'greeting',
    {
        name: z.string().describe('인사할 사람의 이름'),
        language: z
            .enum(['en', 'ko', 'ja'])
            .optional()
            .default('en')
            .describe('인사 언어 (en: 영어, ko: 한국어, ja: 일본어, 기본값: en)')
    },
    async ({ name, language }) => {
        // 언어별 인사말과 이모지 정의
        const greetings = {
            en: {
                message: `Hello, ${name}! Nice to meet you! 👋`,
                description: 'English greeting'
            },
            ko: {
                message: `안녕하세요, ${name}님! 만나서 반갑습니다! 😊`,
                description: '한국어 인사'
            },
            ja: {
                message: `こんにちは、${name}さん！お会いできて嬉しいです！🙏`,
                description: '日本語の挨拶'
            }
        }

        const selectedGreeting = greetings[language]

        return {
            content: [
                {
                    type: 'text',
                    text: selectedGreeting.message
                }
            ],
            annotations: {
                audience: ['user'],
                priority: 1.0,
                metadata: {
                    language: language,
                    description: selectedGreeting.description,
                    timestamp: new Date().toISOString()
                }
            }
        }
    }
)

// 이미지 생성 도구
server.tool(
    'generate_image',
    {
        prompt: z.string().describe('이미지 생성을 위한 프롬프트 설명')
    },
    async ({ prompt }) => {
        try {
            // Hugging Face Token 확인
            const hfToken = process.env.HF_TOKEN;
            if (!hfToken) {
                throw new Error('HF_TOKEN 환경변수가 설정되지 않았습니다');
            }

            // Inference Client 생성
            const client = new InferenceClient(hfToken);

            // 이미지 생성
            const image = await client.textToImage({
                provider: "fal-ai",
                model: "black-forest-labs/FLUX.1-schnell",
                inputs: prompt,
                parameters: { num_inference_steps: 5 },
            });

            // 이미지를 base64로 변환
            let base64Data: string;
            const imageResult = image as any;
            
            if (imageResult instanceof Blob) {
                // Blob인 경우
                const arrayBuffer = await imageResult.arrayBuffer();
                base64Data = Buffer.from(arrayBuffer).toString('base64');
            } else if (typeof imageResult === 'string') {
                // 이미 base64 문자열인 경우
                base64Data = imageResult;
            } else if (imageResult instanceof ArrayBuffer) {
                // ArrayBuffer인 경우
                base64Data = Buffer.from(imageResult).toString('base64');
            } else if (imageResult && imageResult.arrayBuffer) {
                // 다른 형태의 Blob-like 객체인 경우
                const arrayBuffer = await imageResult.arrayBuffer();
                base64Data = Buffer.from(arrayBuffer).toString('base64');
            } else {
                // 기타 경우 JSON 응답일 수 있음
                throw new Error(`Unexpected image format received from API: ${typeof imageResult}`);
            }

            return {
                content: [
                    {
                        type: 'image',
                        data: base64Data,
                        mimeType: 'image/png'
                    }
                ],
                annotations: {
                    audience: ['user'],
                    priority: 0.9,
                    metadata: {
                        prompt: prompt,
                        model: "black-forest-labs/FLUX.1-schnell",
                        provider: "fal-ai",
                        timestamp: new Date().toISOString()
                    }
                }
            };

        } catch (error) {
            // 에러 처리
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            
            return {
                content: [
                    {
                        type: 'text',
                        text: `이미지 생성 중 오류가 발생했습니다: ${errorMessage}`
                    }
                ],
                annotations: {
                    audience: ['user'],
                    priority: 1.0
                }
            };
        }
    }
)

// 예시 리소스: 서버 정보
server.resource(
    'server://info',
    'server://info',
    {
        name: '서버 정보',
        description: 'Multilingual Greeting MCP Server 정보',
        mimeType: 'application/json'
    },
    async () => {
        const serverInfo = {
            name: 'greeting-image-mcp-server',
            version: '1.0.0',
            description: '다국어 인사 및 AI 이미지 생성 MCP 서버 (영어, 한국어, 일본어 지원)',
            supportedLanguages: ['en', 'ko', 'ja'],
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            nodeVersion: process.version,
            platform: process.platform
        }

        return {
            contents: [
                {
                    uri: 'server://info',
                    mimeType: 'application/json',
                    text: JSON.stringify(serverInfo, null, 2)
                }
            ]
        }
    }
)

// 향상된 서버 정보 리소스
server.resource(
    'server://detailed-info',
    'server://detailed-info',
    {
        name: '상세 서버 정보',
        description: 'Greeting MCP Server의 상세한 기능 및 상태 정보',
        mimeType: 'application/json'
    },
    async () => {
        const detailedServerInfo = {
            server: {
                name: 'greeting-image-mcp-server',
                version: '1.0.0',
                description: '다국어 인사 및 AI 이미지 생성 MCP 서버',
                author: 'MCP Developer',
                license: 'ISC'
            },
            capabilities: {
            tools: {
                count: 2,
                available: ['greeting', 'generate_image']
            },
                resources: {
                    count: 2,
                    available: ['server://info', 'server://detailed-info']
                },
                prompts: {
                    count: 1,
                    available: ['code_review']
                }
            },
            tools: {
                greeting: {
                    description: '다국어 인사 도구',
                    parameters: {
                        name: {
                            type: 'string',
                            required: true,
                            description: '인사할 사람의 이름'
                        },
                        language: {
                            type: 'enum',
                            required: false,
                            default: 'en',
                            options: ['en', 'ko', 'ja'],
                            description: '인사 언어 (en: 영어, ko: 한국어, ja: 일본어)'
                        }
                    },
                    supportedLanguages: {
                        en: {
                            name: 'English',
                            example: 'Hello, {name}! Nice to meet you! 👋',
                            emoji: '👋'
                        },
                        ko: {
                            name: '한국어',
                            example: '안녕하세요, {name}님! 만나서 반갑습니다! 😊',
                            emoji: '😊'
                        },
                        ja: {
                            name: '日本語',
                            example: 'こんにちは、{name}さん！お会いできて嬉しいです！🙏',
                            emoji: '🙏'
                        }
                    }
                },
                generate_image: {
                    description: 'AI 이미지 생성 도구',
                    parameters: {
                        prompt: {
                            type: 'string',
                            required: true,
                            description: '이미지 생성을 위한 프롬프트 설명'
                        }
                    },
                    model: 'black-forest-labs/FLUX.1-schnell',
                    provider: 'fal-ai',
                    outputFormat: 'base64-encoded image/png'
                }
            },
            prompts: {
                code_review: {
                    description: 'Comprehensive code review prompt template',
                    parameters: {
                        code: {
                            type: 'string',
                            required: true,
                            description: 'The code to review'
                        }
                    },
                    reviewAreas: [
                        'Code structure and design',
                        'Code quality and naming',
                        'Performance optimization',
                        'Security considerations',
                        'Readability and maintainability'
                    ]
                }
            },
            runtime: {
                nodeVersion: process.version,
                platform: process.platform,
                architecture: process.arch,
                uptime: {
                    seconds: process.uptime(),
                    formatted: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m ${Math.floor(process.uptime() % 60)}s`
                },
                memory: {
                    used: process.memoryUsage().heapUsed,
                    total: process.memoryUsage().heapTotal,
                    external: process.memoryUsage().external,
                    formatted: {
                        used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100} MB`,
                        total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100} MB`
                    }
                },
                pid: process.pid
            },
            status: {
                health: 'healthy',
                ready: true,
                timestamp: new Date().toISOString(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            usage: {
                examples: [
                    {
                        tool: 'greeting',
                        description: 'Basic English greeting',
                        command: 'greeting(name="Alice", language="en")',
                        expectedOutput: 'Hello, Alice! Nice to meet you! 👋'
                    },
                    {
                        tool: 'greeting',
                        description: 'Korean greeting',
                        command: 'greeting(name="철수", language="ko")',
                        expectedOutput: '안녕하세요, 철수님! 만나서 반갑습니다! 😊'
                    },
                    {
                        tool: 'greeting',
                        description: 'Japanese greeting',
                        command: 'greeting(name="田中", language="ja")',
                        expectedOutput: 'こんにちは、田中さん！お会いできて嬉しいです！🙏'
                    },
                    {
                        tool: 'generate_image',
                        description: 'AI image generation',
                        command: 'generate_image(prompt="Astronaut riding a horse")',
                        expectedOutput: 'base64-encoded PNG image'
                    }
                ]
            }
        }

        return {
            contents: [
                {
                    uri: 'server://detailed-info',
                    mimeType: 'application/json',
                    text: JSON.stringify(detailedServerInfo, null, 2)
                }
            ]
        }
    }
)

// 코드 리뷰 프롬프트
server.prompt(
    'code_review',
    'Comprehensive Code Review',
    {
        code: z.string().describe('The code to review')
    },
    async ({ code }) => {
        return {
            messages: [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: `🔍 **종합 코드 리뷰**

다음 코드를 상세히 분석하고 리뷰해주세요:

**검토 항목**:
1. **코드 구조 및 설계**
   - 아키텍처 패턴 적용
   - 모듈화 및 의존성 관리
   - SOLID 원칙 준수

2. **코드 품질**
   - 변수명 및 함수명 적절성
   - 코드 중복 제거
   - 에러 처리 방식

3. **성능 최적화**
   - 알고리즘 효율성
   - 자원 사용 최적화
   - 병목 지점 식별

4. **보안 고려사항**
   - 입력 데이터 검증
   - 인증/인가 처리
   - 민감 정보 보호

5. **가독성 및 유지보수성**
   - 코드 가독성 및 일관성
   - 주석 및 문서화
   - 테스트 가능성
   - 확장성 고려

**리뷰 대상 코드**:
\`\`\`
${code}
\`\`\`

각 항목에 대해 구체적인 피드백과 개선 제안을 제공해주세요. 좋은 부분은 칭찬하고, 개선이 필요한 부분은 구체적인 해결 방안을 제시해주세요.`
                    }
                }
            ]
        }
    }
)

// 서버 시작
async function main() {
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error('다국어 인사 및 AI 이미지 생성 MCP 서버가 시작되었습니다! (English, Korean, Japanese + Image Generation)')
}

main().catch(error => {
    console.error('서버 시작 중 오류 발생:', error)
    process.exit(1)
})
