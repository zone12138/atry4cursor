<!--
 * @Author: xie 1459547902@qq.com
 * @Date: 2025-01-06 09:09:51
 * @LastEditors: xie 1459547902@qq.com
 * @LastEditTime: 2025-01-06 15:11:11
 * @FilePath: \atry4cursor\vite_Vue\src\App.vue
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
-->
<template>
  <el-container class="layout-container">
    <el-header class="header">
      <div class="logo">Canvas Table System</div>
      <el-menu
        :default-active="activeMenu"
        class="menu"
        mode="horizontal"
        router
        @select="handleSelect"
      >
        <el-menu-item index="/canvas-table">
          <el-icon><Document /></el-icon>
          <span>Canvas Table</span>
        </el-menu-item>
      </el-menu>
    </el-header>
    
    <el-main class="main">
      <router-view v-slot="{ Component }">
        <keep-alive :include="['CanvasTable']">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </el-main>
  </el-container>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Document } from '@element-plus/icons-vue'

const route = useRoute()
const activeMenu = computed(() => route.path)

const handleSelect = (key) => {
  console.log('选中菜单:', key)
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.header {
  display: flex;
  align-items: center;
  padding: 0 20px;
  background-color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.logo {
  font-size: 20px;
  font-weight: bold;
  margin-right: 40px;
  color: #409EFF;
}

.menu {
  flex: 1;
}

.main {
  padding: 20px;
  background-color: #f5f7fa;
}
</style>
