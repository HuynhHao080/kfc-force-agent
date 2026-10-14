# Phase 4: Amazon Bedrock Integration

## Overview

This document describes the implementation of Amazon Bedrock integration in the KFC Force Agent system. Phase 4 introduces the LLM provider abstraction layer that enables structured communication with Amazon Bedrock while maintaining the critical separation between LLM understanding and deterministic tool execution.

## Architecture

```
Customer
   ↓
Next.js Web UI
   ↓
Chat API Route
   ↓
ChatService
   ↓
AgentCore
   ↓
LLMProvider
   ├── MockLLMProvider (development)
   └── BedrockLLMProvider (production)
          ↓
     Amazon Bedrock
   ↓
Structured AgentResponse
   ↓
ProposedAction
   ↓
[Phase 5 Tool Execution]
```

## Key Design Principles

### 1. Strict Separation of Concerns
- **LLM Understanding**: Intent extraction, entity recognition, conversation context
- **Structured Output**: JSON responses with defined schema
- **Deterministic Tools**: Phase 5 will execute proposed actions
- **No Direct State Modification**: LLM cannot directly modify database

### 2. Critical Transaction Boundary
```
User
   ↓
LLM Understanding
   ↓
Proposed Action
   ↓
Policy Engine
   ↓
State Machine
   ↓
Deterministic Tool
   ↓
Database / External Service
```

### 3. Provider Abstraction
- **MockLLMProvider**: For local development and testing
- **BedrockLLMProvider**: For production AWS Bedrock integration
- **LLMProvider Interface**: Clean abstraction for switching providers

## Implementation Details

### 1. LLM Provider Abstraction

#### Interface
```typescript
export interface LLMProvider {
  generateResponse(
    systemPrompt: string,
    userPrompt: string,
    conversationHistory?: any[]
  ): Promise<{ success: true; response: any } | { success: false; error: any }>;
}
```

#### Base Class
```typescript
export abstract class BaseLLMProvider implements LLMProvider {
  abstract generateResponse(...): Promise<any>;
  
  protected parseJSONResponse(content: string): any;
  protected validateAgentResponse(response: any): AgentResponse;
}
```

### 2. Mock LLM Provider

For local development and testing without AWS credentials:

```typescript
export class MockLLMProvider extends BaseLLMProvider {
  async generateResponse(...): Promise<{ success: true; response: AgentResponse } | { success: false; error: any }>;
  
  private generateMockResponse(userPrompt: string): AgentResponse;
}
```

**Features**:
- Deterministic responses for testing
- Vietnamese customer-facing messages
- Structured action proposals
- Confidence scoring

### 3. Bedrock LLM Provider

For production AWS Bedrock integration:

```typescript
export class BedrockLLMProvider extends BaseLLMProvider {
  private bedrockService: BedrockService;
  
  constructor(bedrockService: BedrockService);
  
  async generateResponse(...): Promise<{ success: true; response: AgentResponse } | { success: false; error: any }>;
  
  private parseBedrockResponse(content: string): any;
}
```

**Features**:
- AWS Bedrock Runtime client integration
- JSON response parsing
- Error handling
- Fallback for malformed responses

### 4. AgentCore Integration

#### Core Flow
```typescript
export async function agentCore(request: AgentRequest): Promise<any> {
  // 1. Build conversation context
  const context = await buildConversationContext(request.sessionId);
  
  // 2. Build prompt for LLM
  const userPrompt = buildUserPrompt(request.message, context);
  
  // 3. Get response from LLM provider
  const llmResponse = await services.llmProvider.generateResponse(
    systemPrompt,
    userPrompt,
    context
  );
  
  // 4. Parse and validate response
  let agentResponse: AgentResponse;
  try {
    agentResponse = validateAgentResponse(llmResponse.response);
  } catch (validationError) {
    // Fallback to mock response
  }
  
  // 5. Return structured response
  return {
    reply: agentResponse.message,
    sessionId: request.sessionId,
    actions: agentResponse.actions,
    requiresConfirmation: agentResponse.requiresConfirmation,
  };
}
```

#### Configuration
```typescript
function createLLMProvider(): LLMProvider {
  const aiProvider = process.env.AI_PROVIDER || "mock";
  
  switch (aiProvider) {
    case "bedrock":
      return new BedrockLLMProvider(services.bedrockService);
    case "mock":
    default:
      return new MockLLMProvider();
  }
}
```

### 5. System Prompt Architecture

#### File Structure
```
src/
  lib/
    agent/
      prompts/
        system-prompt.md
```

#### System Prompt Content
```markdown
# System Prompt for KFC Force Agent

## Role
Bạn là trợ lý đặt món AI cho KFC Force Agent. Bạn giúp khách hàng đặt món KFC một cách tự nhiên bằng tiếng Việt.

## Ngôn ngữ
Tiếng Việt cho tất cả phản hồi khách hàng.

## Trách nhiệm
- Hiểu ý định của khách hàng từ ngôn ngữ tự nhiên
- Xác định các thực thể liên quan (món ăn, số lượng, tùy chọn)
- Xác định ý định hành động (thêm vào giỏ, xem menu, tạo đơn, xác nhận)
- Duy trì ngữ cảnh cuộc hội thoại
- Đề xuất các hành động có cấu trúc
- Hỏi làm rõ khi thông tin không rõ ràng

## Quy tắc
1. Không bao giờ bịa đặt món ăn
2. Không bao giờ bịa đặt giá cả
3. Không bao giờ tuyên bố một đơn hàng đã được tạo trừ khi hệ thống thực sự thực hiện
4. Không bao giờ tuyên bố thanh toán đã thành công trừ khi một dịch vụ thanh toán xác nhận
5. Không bao giờ tuyên bố giao hàng đã được tạo trừ khi một dịch vụ giao hàng xác nhận
6. Không trực tiếp sửa đổi trạng thái ứng dụng
7. Không bịa đặt sản phẩm không có sẵn
8. Nếu không chắc chắn, hãy hỏi khách hàng làm rõ
9. Phản hồi khách hàng bằng tiếng Việt
10. Đầu ra phải tuân theo schema có cấu trúc

## Phân biệt

**Hiểu biết / Lập kế hoạch**

Khách hàng: "Cho mình 2 combo gà cay."

Hệ thống: "Tôi tìm thấy combo gà cay phù hợp. Bạn có muốn thêm 2 vào giỏ hàng không?"

**Thực hiện giao dịch**

Khách hàng: "Xác nhận đơn."

Hệ thống: (thực hiện tạo đơn, thanh toán, giao hàng)

## Kiến trúc

LLM hiểu
    ↓
Đề xuất hành động
    ↓
AgentCore
    ↓
Tool deterministic
    ↓
Sửa đổi trạng thái
```

### 6. Environment Configuration

#### .env.example
```bash
# Application
APP_NAME=KFC Force Agent
NODE_ENV=development

# AWS Configuration
AWS_REGION=ap-southeast-1
BEDROCK_MODEL_ID=amazon.titan-text-express-v1

# AI Provider Selection
AI_PROVIDER=mock  # or "bedrock"
```

#### Configuration Notes
- `AI_PROVIDER`: Controls which LLM provider to use
- `BEDROCK_MODEL_ID`: AWS Bedrock model identifier
- `AWS_REGION`: AWS region for Bedrock client
- Default is `mock` for local development

### 7. Error Handling

#### Error Categories
- `AI_PROVIDER_NOT_CONFIGURED`
- `BEDROCK_REQUEST_FAILED`
- `BEDROCK_RESPONSE_INVALID`
- `AGENT_RESPONSE_INVALID`
- `AGENT_CONTEXT_INVALID`
- `LLM_TIMEOUT`

#### Error Response Format
```json
{
  "success": false,
  "error": {
    "message": "Vietnamese error message",
    "type": "error_category"
  }
}
```

### 8. Testing

#### Test Coverage
1. **MockLLMProvider Tests**
   - Deterministic response generation
   - Vietnamese message validation
   - Action proposal testing

2. **AgentResponse Schema Validation**
   - JSON schema validation
   - Required field validation
   - Action type validation

3. **Provider Switching Tests**
   - Mock provider functionality
   - Bedrock provider configuration
   - Environment variable handling

4. **Integration Tests**
   - End-to-end conversation flow
   - Structured response parsing
   - Error handling scenarios

#### Test Strategy
- Mock mode for unit tests
- Integration tests with real Bedrock when available
- Backward compatibility tests
- Error scenario testing

### 9. Security

#### Security Principles
- **No Hardcoded Credentials**: AWS credentials managed through environment variables
- **Input Validation**: Zod validation at API boundaries
- **Error Handling**: Generic error messages, no internal details exposed
- **Access Control**: Repository layer prevents direct database access

#### Security Checklist
- [ ] No AWS credentials in source code
- [ ] No secrets sent to Bedrock
- [ ] System prompts not exposed to frontend unnecessarily
- [ ] LLM-generated prices not trusted
- [ ] Arbitrary tool names not executed
- [ ] Action types from strict enum/schema

### 10. Backward Compatibility

#### Unchanged APIs
- `GET /api/health`
- `POST /api/chat`
- `GET /api/menu`
- Existing cart endpoints
- Existing order endpoints
- Vietnamese chat UI

#### Migration Path
- Existing frontend continues to work
- New structured responses are backward compatible
- Mock provider maintains existing behavior
- Bedrock provider adds new capabilities

### 11. Documentation

#### Documentation Files
- `docs/phase4-agent-core.md` - This document
- `docs/agent-core.md` - Detailed AgentCore architecture
- `docs/llm-provider.md` - LLM provider abstraction
- `docs/bedrock-integration.md` - Bedrock-specific integration

#### Documentation Content
- Architecture diagrams
- Configuration instructions
- Testing guidelines
- Error handling procedures
- Security considerations
- Migration paths

### 12. Development Workflow

#### Local Development
1. Set `AI_PROVIDER=mock` in `.env.local`
2. Run `npm run dev`
3. Test chat functionality
4. Verify structured responses
5. Test error scenarios

#### Production Deployment
1. Set `AI_PROVIDER=bedrock` in environment
2. Configure AWS credentials
3. Set `BEDROCK_MODEL_ID` to desired model
4. Deploy with Bedrock provider
5. Monitor integration

#### Testing Workflow
1. Unit tests with mock provider
2. Integration tests with real Bedrock
3. End-to-end conversation testing
4. Error scenario testing
5. Performance testing

### 13. Performance Considerations

#### Response Time
- Mock provider: < 100ms
- Bedrock provider: Depends on model and network
- Context building: Cached where possible

#### Resource Usage
- Memory: Minimal for mock provider
- Network: Required for Bedrock provider
- CPU: Minimal for response parsing

#### Scaling
- Horizontal scaling for Bedrock provider
- Load balancing for multiple conversations
- Connection pooling for Bedrock client

### 14. Monitoring and Observability

#### Metrics
- Provider switching events
- Response time tracking
- Error rate monitoring
- Usage analytics

#### Logging
- Structured logging for errors
- Debug information for troubleshooting
- Performance metrics
- Security event logging

## Migration Guide

### From Phase 3 to Phase 4

#### Changes Required
1. **Update .env.local**: Set `AI_PROVIDER=bedrock`
2. **Configure AWS**: Set up AWS credentials and region
3. **Set Model ID**: Configure `BEDROCK_MODEL_ID`
4. **Test Integration**: Verify Bedrock connectivity
5. **Monitor Performance**: Track response times and error rates

#### Backward Compatibility
- Existing frontend continues to work unchanged
- New structured responses are backward compatible
- Mock provider available for fallback
- Gradual migration path

### Testing Phase 4

#### Local Testing
```bash
# Test with mock provider
AI_PROVIDER=mock npm run dev

# Test with Bedrock provider (requires AWS credentials)
AI_PROVIDER=bedrock npm run dev
```

#### Integration Testing
```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e
```

## Troubleshooting

### Common Issues

#### Mock Provider Not Working
```bash
# Check environment variables
cat .env.local

# Verify AI_PROVIDER setting
AI_PROVIDER=mock
```

#### Bedrock Provider Not Working
```bash
# Check AWS credentials
aws configure list

# Verify BEDROCK_MODEL_ID
BEDROCK_MODEL_ID=amazon.titan-text-express-v1

# Check AWS region
AWS_REGION=ap-southeast-1
```

#### JSON Parsing Errors
```bash
# Check Bedrock response format
# Ensure model returns valid JSON
```

### Support

For issues with Phase 4 implementation:
1. Verify environment variables
2. Check AWS credentials
3. Review Bedrock model configuration
4. Check network connectivity
5. Review application logs

## Conclusion

Phase 4 successfully integrates Amazon Bedrock into the KFC Force Agent system while maintaining the critical architecture principles:

1. **Separation of Concerns**: LLM understanding vs. deterministic execution
2. **Structured Output**: JSON responses with defined schema
3. **Provider Abstraction**: Clean switching between mock and Bedrock
4. **Error Handling**: Comprehensive error handling and fallback
5. **Security**: No hardcoded credentials, input validation
6. **Testing**: Comprehensive test coverage
7. **Documentation**: Complete documentation and migration guides

The implementation provides a solid foundation for Phase 5 (deterministic tool execution) while maintaining backward compatibility and enabling gradual migration to production AWS Bedrock integration.

---

**Files Created/Modified**:
- `src/lib/aws/bedrock.ts` - Bedrock service abstraction
- `src/lib/agent/providers/llm-provider.ts` - LLM provider interface
- `src/lib/agent/providers/mock-llm-provider.ts` - Mock LLM provider
- `src/lib/agent/providers/bedrock-llm-provider.ts` - Bedrock LLM provider
- `src/lib/agent/agent-core.ts` - Updated AgentCore with LLM provider integration
- `src/lib/agent/prompts/system-prompt.md` - System prompt
- `src/lib/types/agent.ts` - Agent response schemas
- `src/lib/services/chat-service.ts` - Updated ChatService
- `docs/phase4-agent-core.md` - This documentation
- `docs/agent-core.md` - Detailed AgentCore documentation
- `docs/llm-provider.md` - LLM provider documentation
- `.env.example` - Environment configuration template

**Architecture Decisions**:
- LLM provider abstraction for flexible AI integration
- Structured response validation for security
- Mock provider for local development
- Bedrock provider for production
- Clean separation between understanding and execution
- Comprehensive error handling and fallback
- Vietnamese customer-facing interface
- Backward compatibility maintained

**Validation**:
- TypeScript strict mode passing
- ESLint warnings addressed
- Next.js build successful
- Mock provider functionality tested
- Structured response parsing validated
- Error handling scenarios covered
- Integration with existing architecture verified

Phase 4 is now complete and ready for Phase 5 (deterministic tool execution).
