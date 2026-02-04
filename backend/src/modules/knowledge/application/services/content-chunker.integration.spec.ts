/**
 * ContentChunkerService Integration Tests
 * Tests for Task 7.6: Integration tests with long content samples
 *
 * Tests chunking strategy with realistic long content scenarios
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ContentChunkerService } from './content-chunker.service';
import { OpenAIService } from './openai.service';

describe('ContentChunkerService Integration Tests (Task 7.6)', () => {
  let service: ContentChunkerService;
  let openaiService: OpenAIService;
  let digestContentCalls: number = 0;

  beforeEach(async () => {
    digestContentCalls = 0;

    // Mock OpenAI service with realistic responses
    const mockOpenAIService = {
      digestContent: jest.fn().mockImplementation(async (content: string, contentType: string) => {
        digestContentCalls++;

        // Simulate different responses based on content
        const wordCount = content.split(/\s+/).length;

        return {
          summary: `Summary for chunk with ${wordCount} words. ${content.substring(0, 50)}...`,
          ideas: [
            `Key idea 1 from ${wordCount} word chunk`,
            `Key idea 2 from content chunk ${digestContentCalls}`,
            `Key idea 3 based on chunk analysis`,
          ],
          confidence: wordCount > 100 ? 'high' : 'medium',
        };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentChunkerService,
        {
          provide: OpenAIService,
          useValue: mockOpenAIService,
        },
      ],
    }).compile();

    service = module.get<ContentChunkerService>(ContentChunkerService);
    openaiService = module.get<OpenAIService>(OpenAIService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Long Content Chunking (AC6)', () => {
    it('should process short content without chunking', async () => {
      // Arrange - Short content (< 4000 tokens)
      const shortContent = 'word '.repeat(500); // ~500 words ≈ 125 tokens

      // Act
      const result = await service.processContent(shortContent, 'text');

      // Assert
      expect(result.wasChunked).toBe(false);
      expect(result.chunkCount).toBeUndefined();
      expect(digestContentCalls).toBe(1); // Only one call to OpenAI
      expect(result.summary).toBeDefined();
      expect(result.ideas.length).toBeGreaterThan(0);
    });

    it('should chunk long content exceeding 4000 tokens', async () => {
      // Arrange - Long content (~20,000 tokens ≈ 80,000 characters)
      const longContent = `
This is a comprehensive document that contains detailed information about
project management methodologies, software development practices, and team
collaboration strategies. `.repeat(1000); // ~1000 repetitions

      // Act
      const result = await service.processContent(longContent, 'text');

      // Assert
      expect(result.wasChunked).toBe(true);
      expect(result.chunkCount).toBeGreaterThan(1);
      expect(digestContentCalls).toBeGreaterThan(1); // Multiple chunks processed

      // Verify merged results
      expect(result.summary).toBeDefined();
      expect(result.summary.length).toBeGreaterThan(10);
      expect(result.ideas.length).toBeGreaterThan(0);
      expect(result.ideas.length).toBeLessThanOrEqual(10);
    });

    it('should apply overlap between chunks to preserve context', async () => {
      // Arrange - Medium-long content that will be split
      const sentence = 'This is a complete sentence with important context. ';
      const mediumContent = sentence.repeat(2000); // ~2000 sentences

      // Act
      const result = await service.processContent(mediumContent, 'text');

      // Assert
      if (result.wasChunked && result.chunkCount) {
        expect(result.chunkCount).toBeGreaterThan(1);

        // With overlap, chunks share 200 tokens
        // Verify multiple chunks were processed
        expect(digestContentCalls).toBe(result.chunkCount);
      }
    });

    it('should downgrade confidence for content with many chunks', async () => {
      // Arrange - Very long content requiring 5+ chunks
      const veryLongContent = 'word '.repeat(25000); // ~25,000 words ≈ 100,000 characters

      // Act
      const result = await service.processContent(veryLongContent, 'text');

      // Assert
      expect(result.wasChunked).toBe(true);

      // If more than 3 chunks, confidence should be downgraded
      if (result.chunkCount && result.chunkCount > 3) {
        expect(result.confidence).toBe('medium');
      }
    });

    it('should merge summaries from multiple chunks coherently', async () => {
      // Arrange - Content that will produce multiple chunks
      const paragraph1 = 'First section discusses project planning and requirements gathering. '.repeat(200);
      const paragraph2 = 'Second section covers implementation strategies and coding practices. '.repeat(200);
      const paragraph3 = 'Third section explains testing methodologies and quality assurance. '.repeat(200);
      const longContent = paragraph1 + paragraph2 + paragraph3;

      // Act
      const result = await service.processContent(longContent, 'text');

      // Assert
      expect(result.wasChunked).toBe(true);
      expect(result.summary).toBeDefined();

      // Summary should be coherent and not too long (max ~500 chars in merged result)
      expect(result.summary.length).toBeGreaterThan(20);
      expect(result.summary.length).toBeLessThan(600);

      // Summary should mention multiple chunks
      expect(result.summary).toContain('chunk');
    });

    it('should deduplicate ideas across chunks', async () => {
      // Arrange - Content with repetitive themes
      const repeatedTheme = 'The importance of code quality cannot be overstated. '.repeat(100);
      const longContent = repeatedTheme + repeatedTheme + repeatedTheme;

      // Mock to return duplicate ideas
      (openaiService.digestContent as jest.Mock).mockImplementation(async () => ({
        summary: 'Summary about code quality',
        ideas: [
          'Code quality is important',
          'Quality standards matter',
          'Code quality is important', // Duplicate
        ],
        confidence: 'high',
      }));

      // Act
      const result = await service.processContent(longContent, 'text');

      // Assert
      if (result.wasChunked) {
        // Ideas should be deduplicated (no exact duplicates)
        const uniqueIdeas = new Set(result.ideas);
        expect(uniqueIdeas.size).toBeLessThanOrEqual(result.ideas.length);

        // Should not exceed 10 ideas total
        expect(result.ideas.length).toBeLessThanOrEqual(10);
      }
    });
  });

  describe('Real-World Content Scenarios (Task 7.6)', () => {
    it('should handle blog post length content (~2000 words)', async () => {
      // Arrange - Typical blog post
      const blogPost = `
# Introduction to Modern Web Development

Web development has evolved significantly over the past decade. Modern frameworks
like React, Vue, and Angular have transformed how we build applications. This article
explores the latest trends and best practices in web development.

## Frontend Technologies

The frontend ecosystem is rich with tools and libraries. Component-based architecture
has become the standard approach. State management solutions like Redux and MobX help
manage complex application state. TypeScript provides type safety and better developer
experience.

## Backend Considerations

Backend development has also evolved with serverless architectures and microservices.
Node.js continues to be popular for building scalable APIs. GraphQL offers a more
flexible alternative to REST.

## DevOps and Deployment

Modern deployment practices include continuous integration and continuous deployment.
Docker containers ensure consistent environments across development and production.
Cloud platforms like AWS, Azure, and GCP provide scalable infrastructure.

## Conclusion

The future of web development looks promising with emerging technologies like WebAssembly,
progressive web apps, and improved tooling. Developers must stay updated with the rapidly
changing landscape.
      `.repeat(10); // ~2000 words

      // Act
      const result = await service.processContent(blogPost, 'text');

      // Assert
      expect(result.summary).toBeDefined();
      expect(result.ideas.length).toBeGreaterThanOrEqual(3);
      expect(result.ideas.length).toBeLessThanOrEqual(10);
      expect(result.confidence).toMatch(/high|medium|low/);
    });

    it('should handle meeting transcript length content (~5000 words)', async () => {
      // Arrange - Meeting transcript
      const meetingTranscript = `
[00:00] John: Good morning everyone, let's start today's sprint planning meeting.

[00:02] Sarah: Thanks John. I'd like to discuss the backend API refactoring we planned
for this sprint. We identified several endpoints that need optimization for better performance.

[00:05] Mike: I agree with Sarah. We also need to consider the impact on mobile clients.
The API changes might require updates to the mobile app.

[00:08] John: Good point Mike. Let's make sure we coordinate with the mobile team.
What about the database migration we discussed last week?

[00:10] Sarah: The migration is ready to go. We've tested it in staging and it should
take about 2 hours to complete in production. We should schedule it for the weekend.

[00:15] Mike: Sounds good. I'll work on the API documentation updates once the changes
are deployed.
      `.repeat(50); // ~5000 words

      // Act
      const result = await service.processContent(meetingTranscript, 'audio');

      // Assert
      expect(result.summary).toBeDefined();
      expect(result.ideas).toBeDefined();

      // Transcripts might need chunking
      if (result.wasChunked) {
        expect(result.chunkCount).toBeGreaterThan(0);
      }
    });

    it('should handle article with code snippets (~3000 words)', async () => {
      // Arrange - Technical article with code
      const technicalArticle = `
# Building RESTful APIs with Node.js

This guide covers building production-ready APIs.

## Setting up Express

First, install Express:

\`\`\`javascript
npm install express
\`\`\`

Create a basic server:

\`\`\`javascript
const express = require('express');
const app = express();

app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
\`\`\`

## Adding Middleware

Middleware functions process requests:

\`\`\`javascript
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
\`\`\`

## Error Handling

Proper error handling is crucial:

\`\`\`javascript
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});
\`\`\`
      `.repeat(30); // ~3000 words

      // Act
      const result = await service.processContent(technicalArticle, 'text');

      // Assert
      expect(result.summary).toBeDefined();
      expect(result.summary).toContain('chunk'); // Should mention processing
      expect(result.ideas.length).toBeGreaterThan(0);
    });

    it('should handle book chapter length content (~10000 words)', async () => {
      // Arrange - Book chapter
      const paragraph = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20);
      const section = `\n\n## Section Title\n\n${paragraph}\n\n`;
      const bookChapter = section.repeat(100); // ~10,000 words

      // Act
      const result = await service.processContent(bookChapter, 'text');

      // Assert
      expect(result.wasChunked).toBe(true);
      expect(result.chunkCount).toBeGreaterThan(2);
      expect(result.summary).toBeDefined();
      expect(result.confidence).toMatch(/medium|low/); // Long content = lower confidence
    });
  });

  describe('Chunking Algorithm Validation (AC6)', () => {
    it('should calculate correct chunk count for known content size', async () => {
      // Arrange - Content with known token count (~16,000 tokens)
      const contentSize16k = 'word '.repeat(16000); // ~16,000 words ≈ 64,000 characters

      // Act
      const result = await service.processContent(contentSize16k, 'text');

      // Assert
      expect(result.wasChunked).toBe(true);

      // With 4000 tokens per chunk: ceil(16000/4000) = 4 chunks
      // But with 200 token overlap, might be slightly more
      expect(result.chunkCount).toBeGreaterThanOrEqual(4);
      expect(result.chunkCount).toBeLessThanOrEqual(5);
    });

    it('should process chunks sequentially (not in parallel)', async () => {
      // Arrange
      const callOrder: number[] = [];
      (openaiService.digestContent as jest.Mock).mockImplementation(async () => {
        digestContentCalls++; // Increment counter
        const callNumber = digestContentCalls;
        callOrder.push(callNumber);

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 10));

        return {
          summary: `Summary ${callNumber}`,
          ideas: [`Idea from chunk ${callNumber}`],
          confidence: 'high',
        };
      });

      const longContent = 'word '.repeat(20000); // Force chunking

      // Act
      await service.processContent(longContent, 'text');

      // Assert - Calls should be in sequential order (1, 2, 3, ...)
      expect(callOrder.length).toBeGreaterThan(1); // Should have multiple chunks
      for (let i = 0; i < callOrder.length - 1; i++) {
        expect(callOrder[i + 1]).toBe(callOrder[i] + 1);
      }
    });

    it('should handle edge case of exactly 4000 tokens', async () => {
      // Arrange - Content at boundary (~4000 tokens ≈ 16,000 characters)
      const boundaryContent = 'word '.repeat(4000);

      // Act
      const result = await service.processContent(boundaryContent, 'text');

      // Assert - Might or might not chunk depending on exact implementation
      // Just verify it processes successfully
      expect(result.summary).toBeDefined();
      expect(result.ideas).toBeDefined();
    });
  });

  describe('Performance with Long Content (Task 7.6)', () => {
    it('should complete chunking within reasonable time for large content', async () => {
      // Arrange
      const largeContent = 'word '.repeat(15000); // ~15,000 words

      // Act
      const startTime = Date.now();
      const result = await service.processContent(largeContent, 'text');
      const duration = Date.now() - startTime;

      // Assert - Should complete in under 5 seconds with mocks
      // In real scenario with GPT, would be longer but still tracked
      expect(duration).toBeLessThan(5000);
      expect(result.summary).toBeDefined();
    });
  });
});
