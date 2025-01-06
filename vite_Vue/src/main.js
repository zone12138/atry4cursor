import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import './style.css'
import App from './App.vue'

// 路由配置
const routes = [
  {
    path: '/',
    redirect: '/canvas-table'
  },
  {
    path: '/canvas-table',
    name: 'CanvasTable',
    component: () => import('./views/CanvasTable.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const app = createApp(App)
app.use(router)
app.use(ElementPlus, {
  locale: zhCn,
})
app.mount('#app')
