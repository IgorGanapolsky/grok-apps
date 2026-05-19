package com.iganapolsky.agentbill.data

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "agentbill")

private object Keys {
    val XAI = stringPreferencesKey("xai_key")
}

@Singleton
class KeyStore @Inject constructor(@ApplicationContext private val context: Context) {
    val xaiKey: Flow<String?> = context.dataStore.data.map { it[Keys.XAI] }

    suspend fun setXaiKey(value: String) {
        context.dataStore.edit { it[Keys.XAI] = value }
    }
}

@Module
@InstallIn(SingletonComponent::class)
object DataStoreModule {
    @Provides
    @Singleton
    fun providePrefs(@ApplicationContext context: Context): androidx.datastore.core.DataStore<Preferences> =
        context.dataStore
}
