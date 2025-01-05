<template>
  <div class="canvas-table" ref="tableContainer">
    <div class="canvas-wrapper" :style="{ width: `${totalWidth}px` }">
      <canvas 
        ref="tableCanvas"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @mouseout="handleMouseOut"
        @contextmenu="handleContextMenu"
        @wheel="handleWheel"
      ></canvas>
    </div>
    <div class="scrollbar-container">
      <div 
        class="scrollbar-thumb" 
        ref="scrollThumb"
        @mousedown="handleScrollStart"
        :style="{
          height: `${thumbHeight}px`,
          transform: `translateY(${thumbPosition}px)`
        }"
      ></div>
    </div>
    <div 
      v-if="tooltip.show" 
      class="tooltip"
      :style="{
        left: `${tooltip.x + 15}px`,
        top: `${tooltip.y + 10}px`
      }"
    >
      {{ tooltip.text }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, defineEmits, computed, toRaw } from 'vue'
import { throttle } from 'lodash'

const props = defineProps({
  data: {
    type: Array,
    required: true
  },
  columns: {
    type: Array,
    required: true
  },
  headerHeight: {
    type: Number,
    default: 40
  },
  rowHeight: {
    type: Number,
    default: 30
  },
  showEllipsis: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['context-menu'])

const tableContainer = ref(null)
const tableCanvas = ref(null)
const ctx = ref(null)
const scrollTop = ref(0)
const selectedRow = ref(null)
const resizingColumn = ref(null)
const hoveredRow = ref(null)
const scrollThumb = ref(null)
const isDraggingScroll = ref(false)
const startDragY = ref(0)
const startScrollTop = ref(0)

// 表格状态
const state = ref({
  columnWidths: {},
  startX: 0,
  isResizing: false,
})

// 计算滚动条高度和位置
const thumbHeight = computed(() => {
  const totalHeight = tableContainer.value?.clientHeight || 0
  const contentHeight = props.data.length * props.rowHeight
  return Math.max(40, (totalHeight / contentHeight) * totalHeight)
})

const thumbPosition = computed(() => {
  const totalHeight = tableContainer.value?.clientHeight || 0
  const contentHeight = props.data.length * props.rowHeight
  const maxScroll = contentHeight - totalHeight
  const scrollableHeight = totalHeight - thumbHeight.value
  return (scrollTop.value / maxScroll) * scrollableHeight
})

// 添加新的响应式变量
const tooltip = ref({
  show: false,
  text: '',
  x: 0,
  y: 0
})

// 添加计算总宽度的计算属性
const totalWidth = computed(() => {
  return props.columns.reduce((sum, _, index) => {
    return sum + (state.value.columnWidths[index] || 150)
  }, 0)
})

onMounted(() => {
  initCanvas()
  window.addEventListener('resize', handleResize)
  render()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('mousemove', handleScrollMove)
  window.removeEventListener('mouseup', handleScrollEnd)
})

const initCanvas = () => {
  const canvas = tableCanvas.value
  ctx.value = canvas.getContext('2d')
  
  const dpr = window.devicePixelRatio
  const containerRect = tableContainer.value.getBoundingClientRect()
  const width = Math.max(totalWidth.value, containerRect.width)
  const height = containerRect.height
  
  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  
  ctx.value.scale(dpr, dpr)
}

const render = throttle(() => {
  if (!ctx.value) return
  
  const context = ctx.value
  context.clearRect(0, 0, tableCanvas.value.width, tableCanvas.value.height)
  
  // 先绘制数据行
  drawRows()
  
  // 后绘制表头，确保表头在最上层
  drawHeaders()
  
  // 绘制选中行高亮
  if (selectedRow.value !== null) {
    drawHighlightRow(selectedRow.value, 'rgba(24, 144, 255, 0.1)')
  }
  
  // 绘制悬停行高亮
  if (hoveredRow.value !== null && hoveredRow.value !== selectedRow.value) {
    drawHighlightRow(hoveredRow.value, 'rgba(0, 0, 0, 0.02)')
  }
}, 16)

const drawHeaders = () => {
  const context = ctx.value
  let x = 0
  
  context.fillStyle = '#f5f5f5'
  context.fillRect(0, 0, totalWidth.value, props.headerHeight)
  
  props.columns.forEach((column, index) => {
    const width = state.value.columnWidths[index] || 150
    
    // 绘制表头文本
    context.fillStyle = '#333'
    context.font = '14px Arial'
    context.textBaseline = 'middle'
    context.fillText(
      column.title,
      x + 10,
      props.headerHeight / 2
    )
    
    // 绘制分割线
    context.beginPath()
    context.moveTo(x + width, 0)
    context.lineTo(x + width, props.headerHeight)
    context.strokeStyle = '#e8e8e8'
    context.stroke()
    
    x += width
  })
}

const drawRows = () => {
  const context = ctx.value
  const startIndex = Math.floor(scrollTop.value / props.rowHeight)
  const visibleRows = Math.ceil(tableCanvas.value.height / props.rowHeight)
  
  const endIndex = Math.min(startIndex + visibleRows, props.data.length)
  
  for (let i = startIndex; i < endIndex; i++) {
    const row = props.data[i]
    const y = i * props.rowHeight - scrollTop.value + props.headerHeight
    
    let x = 0
    props.columns.forEach((column, columnIndex) => {
      const width = state.value.columnWidths[columnIndex] || 150
      const text = String(row[column.key] ?? '')
      
      // 绘制单元格文本
      context.fillStyle = '#333'
      context.font = '14px Arial'
      context.textBaseline = 'middle'
      
      if (props.showEllipsis) {
        // 使用省略号处理
        const textWidth = context.measureText(text).width
        if (textWidth > width - 20) {
          const ellipsisText = getEllipsisText(context, text, width - 20)
          context.fillText(
            ellipsisText,
            x + 10,
            y + props.rowHeight / 2
          )
        } else {
          context.fillText(
            text,
            x + 10,
            y + props.rowHeight / 2
          )
        }
      } else {
        // 改进换行处理逻辑
        const padding = 10
        const maxWidth = width - padding * 2
        let remainingText = text
        let currentY = y + padding // 从单元格顶部开始

        while (remainingText.length > 0 && currentY < y + props.rowHeight - padding) {
          let lineText = ''
          let testText = ''
          let lastSpaceIndex = -1
          
          // 逐个字符测试宽度
          for (let i = 0; i < remainingText.length; i++) {
            testText = remainingText.substring(0, i + 1)
            const testWidth = context.measureText(testText).width
            
            // 记录最后一个空格位置，用于英文单词换行
            if (remainingText[i] === ' ') {
              lastSpaceIndex = i
            }
            
            // 如果超出宽度，进行换行处理
            if (testWidth > maxWidth) {
              // 如果有空格，在空格处换行（英文单词处理）
              if (lastSpaceIndex !== -1 && testText.length > 1) {
                lineText = remainingText.substring(0, lastSpaceIndex)
                remainingText = remainingText.substring(lastSpaceIndex + 1)
              } else {
                // 如果没有空格，直接在当前位置换行
                lineText = remainingText.substring(0, i)
                remainingText = remainingText.substring(i)
              }
              break
            }
            
            // 如果已经是最后一个字符
            if (i === remainingText.length - 1) {
              lineText = remainingText
              remainingText = ''
            }
          }
          
          // 绘制当前行
          context.fillText(lineText, x + padding, currentY)
          currentY += 20 // 行高
          
          // 如果还有剩余文本但已经到达单元格底部，显示省略号
          if (remainingText && currentY >= y + props.rowHeight - padding) {
            let lastLine = lineText
            while (context.measureText(lastLine + '...').width > maxWidth) {
              lastLine = lastLine.slice(0, -1)
            }
            context.fillText(lastLine + '...', x + padding, currentY - 20)
            break
          }
        }
      }
      
      // 绘制列分割线
      context.beginPath()
      context.moveTo(x + width, y)
      context.lineTo(x + width, y + props.rowHeight)
      context.strokeStyle = '#e8e8e8'
      context.stroke()
      
      x += width
    })
    
    // 绘制行分割线
    context.beginPath()
    context.moveTo(0, y + props.rowHeight)
    context.lineTo(totalWidth.value, y + props.rowHeight)
    context.strokeStyle = '#e8e8e8'
    context.stroke()
  }
}

const handleMouseDown = (e) => {
  const { offsetX, offsetY } = e
  
  // 处理列宽调整
  if (isNearColumnBorder(offsetX, offsetY)) {
    state.value.isResizing = true
    state.value.startX = offsetX
    return
  }
  
  // 处理行选择
  if (offsetY > props.headerHeight) {
    const rowIndex = Math.floor((offsetY - props.headerHeight + scrollTop.value) / props.rowHeight)
    selectedRow.value = rowIndex
    render()
  }
}

const handleMouseMove = (e) => {
  const { offsetX, offsetY } = e
  
  if (state.value.isResizing && resizingColumn.value !== null) {
    const diff = offsetX - state.value.startX
    state.value.columnWidths[resizingColumn.value] = 
      (state.value.columnWidths[resizingColumn.value] || 150) + diff
    state.value.startX = offsetX
    render()
    return
  }
  
  // 更新悬停状态 - 只记录行索引
  const cell = getCellFromPoint(offsetX, offsetY)
  if (cell) {
    hoveredRow.value = cell.rowIndex
  } else {
    hoveredRow.value = null
  }
  
  // 处理 tooltip
  if (cell && props.showEllipsis) {
    const text = String(props.data[cell.rowIndex]?.[props.columns[cell.columnIndex].key] ?? '')
    const width = state.value.columnWidths[cell.columnIndex] || 150
    const context = ctx.value
    context.font = '14px Arial'
    const textWidth = context.measureText(text).width
    
    if (textWidth > width - 20) {
      tooltip.value = {
        show: true,
        text,
        x: e.clientX,
        y: e.clientY
      }
    } else {
      tooltip.value.show = false
    }
  } else {
    tooltip.value.show = false
  }
  
  render()
}

const handleMouseUp = () => {
  state.value.isResizing = false
  resizingColumn.value = null
}

const handleContextMenu = (e) => {
  e.preventDefault()
  const { offsetX, offsetY } = e
  const cell = getCellFromPoint(offsetX, offsetY)
  
  if (cell) {
    // 触发自定义右键菜单事件
    emit('context-menu', {
      cell,
      event: e
    })
  }
}

const handleWheel = (e) => {
  e.preventDefault()
  const totalHeight = tableContainer.value.clientHeight
  const contentHeight = props.data.length * props.rowHeight
  
  if (e.shiftKey) {
    // 水平滚动
    const totalWidth = props.columns.reduce((sum, _, index) => {
      return sum + (state.value.columnWidths[index] || 150)
    }, 0)
    const containerWidth = tableContainer.value.clientWidth
    
    if (totalWidth > containerWidth) {
      const currentScroll = tableContainer.value.scrollLeft || 0
      tableContainer.value.scrollLeft = Math.max(
        0,
        Math.min(
          currentScroll + e.deltaY,
          totalWidth - containerWidth
        )
      )
    }
  } else {
    // 垂直滚动
    scrollTop.value = Math.max(
      0,
      Math.min(
        scrollTop.value + e.deltaY,
        contentHeight - totalHeight
      )
    )
  }
  render()
}

const handleResize = throttle(() => {
  initCanvas()
  render()
}, 100)

// 工具函数
const isNearColumnBorder = (x, y) => {
  if (y > props.headerHeight) return false
  
  let currentX = 0
  for (let i = 0; i < props.columns.length; i++) {
    currentX += state.value.columnWidths[i] || 150
    if (Math.abs(x - currentX) < 5) {
      resizingColumn.value = i
      return true
    }
  }
  return false
}

const getCellFromPoint = (x, y) => {
  if (y < props.headerHeight) return null
  
  const rowIndex = Math.floor((y - props.headerHeight + scrollTop.value) / props.rowHeight)
  
  let currentX = 0
  let columnIndex = 0
  
  for (let i = 0; i < props.columns.length; i++) {
    const width = state.value.columnWidths[i] || 150
    if (x >= currentX && x < currentX + width) {
      columnIndex = i
      break
    }
    currentX += width
  }
  
  return {
    rowIndex,
    columnIndex,
    value: props.data[rowIndex]?.[props.columns[columnIndex].key],
    row: toRaw(props.data[rowIndex]),
    column: props.columns[columnIndex],
  }
}

const drawHighlightRow = (rowIndex, color) => {
  const context = ctx.value
  const y = rowIndex * props.rowHeight - scrollTop.value + props.headerHeight
  
  context.fillStyle = color
  context.fillRect(0, y, totalWidth.value, props.rowHeight)
}

// 添加滚动条拖动相关方法
const handleScrollStart = (e) => {
  isDraggingScroll.value = true
  startDragY.value = e.clientY
  startScrollTop.value = scrollTop.value
  
  // 添加全局事件监听
  window.addEventListener('mousemove', handleScrollMove)
  window.addEventListener('mouseup', handleScrollEnd)
}

const handleScrollMove = (e) => {
  if (!isDraggingScroll.value) return
  
  const deltaY = e.clientY - startDragY.value
  const totalHeight = tableContainer.value.clientHeight
  const contentHeight = props.data.length * props.rowHeight
  const scrollableHeight = totalHeight - thumbHeight.value
  
  const scrollRatio = (contentHeight - totalHeight) / scrollableHeight
  const newScrollTop = startScrollTop.value + deltaY * scrollRatio
  
  scrollTop.value = Math.max(0, Math.min(newScrollTop, contentHeight - totalHeight))
  render()
}

const handleScrollEnd = () => {
  isDraggingScroll.value = false
  window.removeEventListener('mousemove', handleScrollMove)
  window.removeEventListener('mouseup', handleScrollEnd)
}

// 添加文本截断辅助函数
const getEllipsisText = (context, text, maxWidth) => {
  const ellipsis = '...'
  const ellipsisWidth = context.measureText(ellipsis).width
  
  if (context.measureText(text).width <= maxWidth) {
    return text
  }
  
  let left = 0
  let right = text.length
  let mid = 0
  
  while (left < right) {
    mid = Math.floor((left + right + 1) / 2)
    const truncated = text.substring(0, mid) + ellipsis
    const width = context.measureText(truncated).width
    
    if (width <= maxWidth) {
      left = mid
    } else {
      right = mid - 1
    }
  }
  
  return text.substring(0, left) + ellipsis
}

// 添加 mouseout 事件处理
const handleMouseOut = () => {
  tooltip.value.show = false
  hoveredRow.value = null
  render()
}
</script>

<style scoped>
.canvas-table {
  width: 100%;
  height: 100%;
  overflow: auto;
  position: relative;
}

.canvas-wrapper {
  position: relative;
  height: 100%;
}

canvas {
  display: block;
}

.scrollbar-container {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 12px;
  background-color: #f5f5f5;
  border-left: 1px solid #e8e8e8;
}

.scrollbar-thumb {
  position: absolute;
  width: 8px;
  left: 2px;
  border-radius: 4px;
  background-color: #c1c1c1;
  cursor: pointer;
  transition: background-color 0.2s;
  user-select: none;
}

.scrollbar-thumb:hover {
  background-color: #a1a1a1;
}

.scrollbar-thumb:active {
  background-color: #909090;
}

.tooltip {
  position: fixed;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
  max-width: 300px;
  word-wrap: break-word;
  z-index: 1000;
  pointer-events: none;
}

/* 添加动画效果 */
.tooltip {
  animation: fadeIn 0.2s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style> 