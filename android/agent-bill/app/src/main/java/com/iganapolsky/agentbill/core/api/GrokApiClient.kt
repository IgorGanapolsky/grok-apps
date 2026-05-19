package com.iganapolsky.agentbill.core.api

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.headers
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
private data class ChatRequest(
    val model: String,
    val messages: List<Message>,
    val temperature: Double = 0.2,
)

@Serializable
private data class Message(val role: String, val content: String)

@Serializable
private data class ChatResponse(
    val choices: List<Choice> = emptyList(),
) {
    @Serializable
    data class Choice(
        val index: Int = 0,
        val message: ResponseMessage,
        @SerialName("finish_reason") val finishReason: String? = null,
    )

    @Serializable
    data class ResponseMessage(val role: String, val content: String)
}

@Singleton
class GrokApiClient @Inject constructor(private val http: HttpClient) {
    suspend fun complete(
        apiKey: String,
        system: String,
        user: String,
        model: String = "grok-4",
    ): String {
        val response: ChatResponse = http.post("https://api.x.ai/v1/chat/completions") {
            contentType(ContentType.Application.Json)
            headers { append(HttpHeaders.Authorization, "Bearer $apiKey") }
            setBody(
                ChatRequest(
                    model = model,
                    messages = listOf(
                        Message("system", system),
                        Message("user", user),
                    ),
                ),
            )
        }.body()
        return response.choices.firstOrNull()?.message?.content
            ?: error("Empty response from xAI")
    }
}

@Module
@InstallIn(SingletonComponent::class)
object NetModule {
    @Provides
    @Singleton
    fun provideHttp(): HttpClient = HttpClient(OkHttp) {
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true; isLenient = true })
        }
    }
}
