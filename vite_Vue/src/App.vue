<template>
  <div class="table-container">
    <CanvasTable
      :data="tableData"
      :columns="columns"
      :show-ellipsis="false"
      :row-height="80"
      @context-menu="handleContextMenu"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import CanvasTable from './components/CanvasTable.vue'

const columns = [
  { title: 'ID', key: 'id', width: 100 },
  { title: '姓名', key: 'name', width: 150 },
  { title: '年龄', key: 'age', width: 100 },
  { title: '地址', key: 'address' },
]

// 生成模拟数据
const tableData = ref(Array.from({ length: 10000 }, (_, index) => ({
  id: index + 1,
  name: `用户 ${index + 1}`,
  age: Math.floor(Math.random() * 50) + 18,
  address: `地址地址地址地址地址地址地址地址地址地址地址地址地址地址地址地址地址地址地址地址地址地址地址地址地址地址${index + 1}`,
})))

const handleContextMenu = ({ cell, event }) => {
  console.log('右键点击:', cell)
  // 在这里实现自定义右键菜单
}
</script>

<style scoped>
.table-container {
  width: 100%;
  height: 100%;
}
</style>
