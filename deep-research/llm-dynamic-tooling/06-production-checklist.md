# Production Deployment Checklist - LLM Dynamic Tooling

## Pre-Deployment Planning

### Architecture Design

- [ ] **Choose architecture pattern**
  - [ ] Single-agent system (dynamic tool selection)
  - [ ] Multi-agent system (specialized agents)
  - [ ] Deterministic chain (fixed workflows)
  - [ ] Hybrid approach

- [ ] **Select LLM provider(s)**
  - [ ] Primary model selected (Claude Sonnet 4.5 recommended)
  - [ ] Fallback model configured
  - [ ] API keys secured in environment variables
  - [ ] Rate limits documented

- [ ] **Design tool registry**
  - [ ] Tool naming convention established
  - [ ] Tool versioning strategy defined
  - [ ] Tool deprecation process documented
  - [ ] Maximum number of tools determined

- [ ] **Plan MCP integration (if applicable)**
  - [ ] Transport mechanism selected (Streamable HTTP for mobile)
  - [ ] Server architecture designed
  - [ ] Authentication strategy defined (OAuth 2.1)
  - [ ] Deployment infrastructure planned

### Mobile-Specific Planning

- [ ] **Hybrid architecture designed**
  - [ ] Local vs. remote tool execution criteria defined
  - [ ] Offline queue implementation planned
  - [ ] Network state monitoring strategy
  - [ ] Battery optimization approach documented

- [ ] **Resource constraints analyzed**
  - [ ] Context window budget allocated
  - [ ] Tool description size limits set (500 char warning, 1000 alert)
  - [ ] Maximum concurrent requests defined
  - [ ] Memory usage limits established

## Development Phase

### Tool Implementation

- [ ] **Core tool development**
  - [ ] Tool handlers implemented with error handling
  - [ ] Input validation for all parameters
  - [ ] Output formatting standardized
  - [ ] Timeout mechanisms in place (default: 30s)

- [ ] **Tool descriptions optimized**
  - [ ] All descriptions under 500 characters
  - [ ] Clear, concise language used
  - [ ] Input parameter descriptions complete
  - [ ] Expected output format documented

- [ ] **Dynamic registry implemented**
  - [ ] Add/remove tools at runtime
  - [ ] Context-aware tool filtering
  - [ ] Permission-based tool access
  - [ ] Session-based tool management

### Security Implementation

- [ ] **Authentication & Authorization**
  - [ ] API keys stored securely (environment variables)
  - [ ] OAuth 2.1 implemented for MCP servers
  - [ ] Resource Indicators (RFC 8707) configured
  - [ ] User permission system implemented

- [ ] **Input Validation**
  - [ ] All tool inputs validated against schemas
  - [ ] SQL injection prevention
  - [ ] Command injection prevention
  - [ ] Path traversal prevention

- [ ] **Output Sanitization**
  - [ ] Secrets never echoed in responses
  - [ ] PII redaction implemented
  - [ ] Error messages sanitized
  - [ ] Logs scrubbed of sensitive data

- [ ] **Rate Limiting**
  - [ ] Per-user rate limits configured
  - [ ] Per-tool rate limits set
  - [ ] API provider rate limits respected
  - [ ] Backoff strategies implemented

### Error Handling

- [ ] **Comprehensive error handling**
  - [ ] All tool executions wrapped in try/catch
  - [ ] Network errors handled gracefully
  - [ ] Timeout errors managed
  - [ ] LLM API errors caught and logged

- [ ] **Retry logic**
  - [ ] Exponential backoff implemented
  - [ ] Maximum retry attempts configured (3-5)
  - [ ] Jitter added to prevent thundering herd
  - [ ] Circuit breakers for failing services

- [ ] **User-facing error messages**
  - [ ] Generic error messages for users
  - [ ] Detailed errors logged for debugging
  - [ ] Actionable error suggestions provided
  - [ ] Error recovery guidance included

### Context Window Management

- [ ] **Token budget planning**
  - [ ] System prompt size: ≤5-10% of context window
  - [ ] Tool descriptions: ≤10-15% of context window
  - [ ] Conversation history: managed with summarization
  - [ ] Tool results: filtered before adding to context

- [ ] **Optimization strategies**
  - [ ] Long reference docs moved to RAG
  - [ ] Tool descriptions kept concise
  - [ ] Conversation compaction implemented
  - [ ] Programmatic tool calling used (Claude)

### Monitoring & Logging

- [ ] **Tool execution logging**
  - [ ] Tool name, input, output logged
  - [ ] Execution duration tracked
  - [ ] Success/failure status recorded
  - [ ] User context captured (anonymized)

- [ ] **Performance metrics**
  - [ ] Latency percentiles (P50, P95, P99)
  - [ ] Token usage per request
  - [ ] Cost per request
  - [ ] Tool usage frequency

- [ ] **Error tracking**
  - [ ] Error rates by tool
  - [ ] Error types categorized
  - [ ] Retry success rates
  - [ ] Timeout frequency

- [ ] **Business metrics**
  - [ ] User satisfaction indicators
  - [ ] Task completion rates
  - [ ] Tool effectiveness scores
  - [ ] Cost per successful interaction

### Testing

- [ ] **Unit tests**
  - [ ] Each tool handler tested
  - [ ] Input validation tested
  - [ ] Error conditions tested
  - [ ] Edge cases covered

- [ ] **Integration tests**
  - [ ] End-to-end tool calling flows
  - [ ] Multi-tool scenarios
  - [ ] Error recovery paths
  - [ ] Offline mode (mobile)

- [ ] **Performance tests**
  - [ ] Load testing at expected scale
  - [ ] Stress testing beyond expected load
  - [ ] Latency benchmarks established
  - [ ] Memory usage profiled

- [ ] **Security tests**
  - [ ] Penetration testing completed
  - [ ] Input fuzzing performed
  - [ ] Authentication bypass attempts tested
  - [ ] Rate limiting validated

## Mobile-Specific Checklist

### Network Optimization

- [ ] **Connection management**
  - [ ] Streamable HTTP transport configured
  - [ ] Connection pooling implemented
  - [ ] Keep-alive headers set
  - [ ] DNS caching enabled

- [ ] **Request optimization**
  - [ ] Request compression enabled (gzip)
  - [ ] Response caching implemented
  - [ ] Conditional requests used (ETags)
  - [ ] Request batching where possible

- [ ] **Offline support**
  - [ ] Network state detection
  - [ ] Offline queue implementation
  - [ ] Cached tool definitions
  - [ ] Background sync when online

### Battery & Performance

- [ ] **Resource management**
  - [ ] Battery level monitoring
  - [ ] Low power mode detection
  - [ ] Background task limitations
  - [ ] Memory warnings handled

- [ ] **Execution optimization**
  - [ ] Local execution for simple tasks
  - [ ] Remote execution deferred when low battery
  - [ ] Tool result caching
  - [ ] Lazy loading of tool definitions

### Platform-Specific

- [ ] **iOS**
  - [ ] Background execution configured
  - [ ] App Transport Security (ATS) configured
  - [ ] Memory warnings handled
  - [ ] Push notification support (optional)

- [ ] **Android**
  - [ ] Doze mode handling
  - [ ] Battery optimization exemptions (if needed)
  - [ ] Network security config
  - [ ] Background service limits

## Deployment

### Infrastructure

- [ ] **API provider setup**
  - [ ] Production API keys obtained
  - [ ] Rate limits increased (if needed)
  - [ ] Billing alerts configured
  - [ ] Quota monitoring in place

- [ ] **MCP server deployment (if applicable)**
  - [ ] Servers deployed to production environment
  - [ ] Load balancing configured
  - [ ] Auto-scaling rules set
  - [ ] Health checks implemented

- [ ] **Supporting services**
  - [ ] Logging infrastructure (e.g., Datadog, LogRocket)
  - [ ] Metrics collection (e.g., Prometheus)
  - [ ] Error tracking (e.g., Sentry)
  - [ ] APM tools configured

### Configuration

- [ ] **Environment variables**
  - [ ] All secrets in environment variables
  - [ ] Production vs. staging configs separated
  - [ ] Feature flags configured
  - [ ] Rollback plan documented

- [ ] **Model configuration**
  - [ ] Model version pinned
  - [ ] Max tokens configured
  - [ ] Temperature set appropriately
  - [ ] Timeout values tuned

- [ ] **Tool registry**
  - [ ] Production tools registered
  - [ ] Tool permissions configured
  - [ ] Tool rate limits set
  - [ ] Deprecated tools removed

### Security Hardening

- [ ] **Production security**
  - [ ] HTTPS everywhere
  - [ ] Certificate pinning (mobile)
  - [ ] Secrets rotation strategy
  - [ ] Audit logging enabled

- [ ] **Access control**
  - [ ] Principle of least privilege applied
  - [ ] User permission system tested
  - [ ] Admin access restricted
  - [ ] API key permissions scoped

- [ ] **Compliance**
  - [ ] GDPR compliance verified (if applicable)
  - [ ] Data retention policies implemented
  - [ ] Privacy policy updated
  - [ ] Terms of service reflect AI usage

## Post-Deployment

### Monitoring & Alerts

- [ ] **Alert thresholds configured**
  - [ ] Error rate > 5%
  - [ ] Latency P95 > 3 seconds
  - [ ] Tool failure rate > 10%
  - [ ] API cost spike > 150% of baseline

- [ ] **Dashboard creation**
  - [ ] Real-time tool usage metrics
  - [ ] Cost tracking dashboard
  - [ ] Error rate visualization
  - [ ] Latency trends

- [ ] **On-call procedures**
  - [ ] Incident response plan documented
  - [ ] Escalation paths defined
  - [ ] Runbooks created for common issues
  - [ ] Team rotation schedule

### Optimization

- [ ] **Performance optimization**
  - [ ] Slow tools identified and optimized
  - [ ] Caching opportunities exploited
  - [ ] Unnecessary tool calls eliminated
  - [ ] Context window usage reduced

- [ ] **Cost optimization**
  - [ ] Expensive tools identified
  - [ ] Model selection per use case
  - [ ] Token usage minimized
  - [ ] Alternative approaches evaluated

- [ ] **User experience**
  - [ ] Latency improvements based on metrics
  - [ ] Error message clarity improved
  - [ ] Tool availability optimized
  - [ ] Feedback incorporated

### Maintenance

- [ ] **Regular reviews**
  - [ ] Weekly metrics review
  - [ ] Monthly cost analysis
  - [ ] Quarterly security audit
  - [ ] Annual architecture review

- [ ] **Tool lifecycle**
  - [ ] Unused tools deprecated
  - [ ] New tools added based on demand
  - [ ] Tool versions upgraded
  - [ ] Breaking changes communicated

- [ ] **Documentation**
  - [ ] Architecture docs updated
  - [ ] API documentation current
  - [ ] Runbooks maintained
  - [ ] Incident post-mortems documented

## MCP-Specific Checklist

### MCP Server Deployment

- [ ] **Server implementation**
  - [ ] Single Responsibility Principle followed
  - [ ] Semantic versioning used
  - [ ] Tool list cached
  - [ ] Notification system implemented

- [ ] **Transport configuration**
  - [ ] Streamable HTTP endpoint configured
  - [ ] OAuth 2.1 authentication
  - [ ] Resource Indicators implemented
  - [ ] Proper HTTP headers set

- [ ] **Production readiness**
  - [ ] Load balancer configured
  - [ ] Health check endpoint
  - [ ] Graceful shutdown handling
  - [ ] Connection limits set

### MCP Client Integration

- [ ] **Client setup**
  - [ ] Connection pooling
  - [ ] Retry logic with exponential backoff
  - [ ] Circuit breaker pattern
  - [ ] Timeout configuration

- [ ] **Capability negotiation**
  - [ ] Protocol version compatibility checked
  - [ ] Capabilities validated
  - [ ] Feature flags for optional capabilities
  - [ ] Fallback behavior defined

- [ ] **Tool synchronization**
  - [ ] Initial tool list fetch
  - [ ] Notification subscription
  - [ ] Auto-refresh on changes
  - [ ] Cache invalidation strategy

## Common Pitfalls to Avoid

### Development Pitfalls

- [ ] ❌ Overly verbose tool descriptions (>1000 chars)
- [ ] ❌ Unbounded tool sets (>50 tools)
- [ ] ❌ No timeout on tool execution
- [ ] ❌ Missing input validation
- [ ] ❌ Secrets in tool results
- [ ] ❌ No error handling in tool handlers
- [ ] ❌ Synchronous blocking calls in mobile app

### Architecture Pitfalls

- [ ] ❌ Starting with multi-agent (too complex)
- [ ] ❌ No fallback model configured
- [ ] ❌ Tightly coupled tool implementations
- [ ] ❌ No versioning strategy
- [ ] ❌ Ignoring context window limits
- [ ] ❌ No caching strategy

### Security Pitfalls

- [ ] ❌ API keys in code/version control
- [ ] ❌ No rate limiting
- [ ] ❌ Insufficient input validation
- [ ] ❌ Detailed error messages to users
- [ ] ❌ No authentication for MCP servers
- [ ] ❌ Missing audit logging

### Mobile Pitfalls

- [ ] ❌ Using STDIO transport (won't work remotely)
- [ ] ❌ No offline handling
- [ ] ❌ Ignoring battery constraints
- [ ] ❌ Not caching tool definitions
- [ ] ❌ No network state monitoring
- [ ] ❌ Blocking main thread with LLM calls

## Emergency Procedures

### LLM API Outage

1. [ ] Switch to fallback model automatically
2. [ ] Queue requests if both APIs down
3. [ ] Notify users of degraded service
4. [ ] Monitor API status pages
5. [ ] Incident post-mortem after recovery

### High Error Rate

1. [ ] Check LLM API status
2. [ ] Review recent tool deployments
3. [ ] Check for schema mismatches
4. [ ] Verify network connectivity
5. [ ] Rollback if recent changes

### Cost Spike

1. [ ] Identify high-cost requests
2. [ ] Check for infinite loops
3. [ ] Review tool execution logs
4. [ ] Implement emergency rate limits
5. [ ] Notify stakeholders

### Security Incident

1. [ ] Rotate all API keys immediately
2. [ ] Review audit logs
3. [ ] Disable affected tools
4. [ ] Notify security team
5. [ ] Document incident for review

## Success Metrics

### Technical KPIs

- [ ] **Latency:** P95 < 3 seconds
- [ ] **Error rate:** < 5%
- [ ] **Tool success rate:** > 90%
- [ ] **Availability:** > 99.9%
- [ ] **Cost per request:** Within budget

### Business KPIs

- [ ] **User satisfaction:** > 4/5 stars
- [ ] **Task completion rate:** > 80%
- [ ] **Daily active users:** Growing
- [ ] **Feature adoption:** > 60%
- [ ] **Support ticket reduction:** Target met

### Mobile-Specific KPIs

- [ ] **App crash rate:** < 1%
- [ ] **Battery drain:** < 10% per hour of use
- [ ] **Offline functionality:** 100% for cached tools
- [ ] **Network data usage:** Within acceptable range
- [ ] **Cold start time:** < 2 seconds

## Conclusion

This checklist provides a comprehensive framework for deploying LLM applications with dynamic tooling to production. Adapt these items to your specific requirements, and remember:

**Key Principles:**
1. **Start simple** - Begin with deterministic chains, evolve to dynamic selection
2. **Security first** - Validate inputs, sanitize outputs, rotate secrets
3. **Monitor everything** - Logs, metrics, costs, errors
4. **Optimize continuously** - Performance, cost, user experience
5. **Plan for failure** - Fallbacks, retries, graceful degradation

Use this checklist as a living document, updating it as you learn from production experience and as the LLM tooling ecosystem evolves.
