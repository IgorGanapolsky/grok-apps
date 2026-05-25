package com.iganapolsky.agentbill.core.api

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class GrokApiClientTest {

    @Test
    fun testGrokApiClientCompletesSuccessfully() = runBlocking {
        // Setup Ktor MockEngine
        val mockEngine = MockEngine { request ->
            // Verify endpoint URL
            assertEquals("https://api.x.ai/v1/chat/completions", request.url.toString())
            // Verify Authorization Header
            assertEquals("Bearer mock_key", request.headers[HttpHeaders.Authorization])
            
            respond(
                content = """
                    {
                        "choices": [
                            {
                                "index": 0,
                                "message": {
                                    "role": "assistant",
                                    "content": "Mock completion response text"
                                },
                                "finish_reason": "stop"
                            }
                        ]
                    }
                """.trimIndent(),
                status = HttpStatusCode.OK,
                headers = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            )
        }

        val httpClient = HttpClient(mockEngine) {
            install(ContentNegotiation) {
                json(Json { ignoreUnknownKeys = true; isLenient = true })
            }
        }

        val client = GrokApiClient(httpClient)

        val result = client.complete(
            apiKey = "mock_key",
            system = "System rule",
            user = "User query",
            model = "grok-4"
        )

        assertEquals("Mock completion response text", result)
        assertNotNull(client)
    }
}
