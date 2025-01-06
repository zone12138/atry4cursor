<template>
  <div class="table-container">
    <CanvasTable
      :data="tableData"
      :columns="columns"
      :show-ellipsis="false"
      :row-height="80"
      @context-menu="handleContextMenu"
    />
    <ContextMenu
      v-model:visible="contextMenuVisible"
      :position="contextMenuPosition"
      :menu-items="menuItems"
      @select="handleMenuSelect"
    />
  </div>
</template>

<script setup>
import { ref, onActivated, onDeactivated } from 'vue'
import CanvasTable from '../components/CanvasTable.vue'
import ContextMenu from '../components/ContextMenu.vue'

// 定义组件名称，用于 keep-alive
defineOptions({
  name: 'CanvasTable'
})

const columns = [
  { title: 'ID', key: 'id', width: 100 },
  { title: '姓名', key: 'name', width: 150 },
  { title: '年龄', key: 'age', width: 100 },
  { title: '地址', key: 'address' },
]

// 生成模拟数据
const tableData = ref(Array.from({ length: 1000000 }, (_, index) => ({
  id: index + 1,
  name: `用户 ${index + 1}`,
  age: Math.floor(Math.random() * 50) + 18,
  address: `ABCDEFGHIJKLMNOPQRSTUVWXYZ一二三四五六七八九十${index + 1}`,
})))

const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const currentCell = ref(null)

const menuItems = [
  { 
    key: 'operations',
    label: '操作',
    children: [
      { key: 'copy', label: '复制' },
      { key: 'edit', label: '编辑' },
      { key: 'delete', label: '删除' }
    ]
  },
  { 
    key: 'export',
    label: '导出',
    children: [
      { key: 'exportExcel', label: 'Excel' },
      { key: 'exportPDF', label: 'PDF' },
      { 
        key: 'otherFormats',
        label: '其他格式',
        children: [
          { key: 'exportCSV', label: 'CSV' },
          { key: 'exportTXT', label: 'TXT' }
        ]
      }
    ]
  },
  { key: 'refresh', label: '刷新' }
]

const handleContextMenu = ({ cell, event }) => {
  event.preventDefault()
  currentCell.value = cell
  contextMenuPosition.value = {
    x: event.clientX,
    y: event.clientY
  }
  contextMenuVisible.value = true
}

const handleMenuSelect = (item) => {
  switch (item.key) {
    case 'copy':
      navigator.clipboard.writeText(currentCell.value.value)
      break
    case 'edit':
      console.log('编辑:', currentCell.value)
      break
    case 'delete':
      console.log('删除:', currentCell.value)
      break
    case 'exportExcel':
      console.log('导出 Excel')
      break
    case 'exportPDF':
      console.log('导出 PDF')
      break
    case 'exportCSV':
      console.log('导出 CSV')
      break
    case 'exportTXT':
      console.log('导出 TXT')
      break
    case 'refresh':
      console.log('刷新数据')
      break
  }
}

// 组件被激活时触发
onActivated(() => {
  console.log('组件被激活')
})

// 组件被缓存时触发
onDeactivated(() => {
  console.log('组件被缓存')
})
</script>

<style scoped>
.table-container {
  width: 100%;
  height: 100%;
}
</style> 