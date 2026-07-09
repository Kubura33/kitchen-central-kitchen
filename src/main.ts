import { createApp } from 'vue'
import App from './App.vue'
import './styles/main.css'
import { applyPendingUpdate } from './tauri'

createApp(App).mount('#app')
void applyPendingUpdate()
