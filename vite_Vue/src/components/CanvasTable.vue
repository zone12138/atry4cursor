<template>
  <div class="canvas-table" ref="tableContainer">
    <div 
      class="canvas-wrapper" 
      :style="{ 
        width: `${Math.max(totalWidth, containerWidth)}px`,
        transform: `translateX(${-scrollLeft}px)`
      }"
    >
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
    <div v-if="showScrollbar" class="scrollbar-track">
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
    <div v-if="showHorizontalScrollbar" class="horizontal-scrollbar-track">
      <div 
        class="horizontal-scrollbar-thumb"
        ref="horizontalScrollThumb"
        @mousedown="handleHorizontalScrollStart"
        :style="{
          width: `${horizontalThumbWidth}px`,
          transform: `translateX(${horizontalThumbPosition}px)`
        }"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, defineEmits, computed, toRaw, watch, nextTick } from 'vue'

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
  const containerHeight = tableContainer.value?.clientHeight - props.headerHeight || 0
  const contentHeight = props.data.length * props.rowHeight
  const minThumbHeight = 40
  const heightRatio = containerHeight / contentHeight
  
  // 确保滚动条高度不小于最小值
  return Math.max(minThumbHeight, heightRatio * containerHeight)
})

const thumbPosition = computed(() => {
  const containerHeight = tableContainer.value?.clientHeight - props.headerHeight || 0
  const contentHeight = props.data.length * props.rowHeight
  const maxScroll = contentHeight - containerHeight
  const scrollableHeight = containerHeight - thumbHeight.value
  
  // 计算滚动条位置，并加上表头高度作为起始位置
  return maxScroll === 0 ? props.headerHeight : 
    (scrollTop.value / maxScroll) * scrollableHeight + props.headerHeight
})

// 添加新的响应式变量
const tooltip = ref({
  show: false,
  text: '',
  x: 0,
  y: 0
})

// 添加容器宽度的响应式引用
const containerWidth = ref(0)

// 监听容器宽度变化
watch(containerWidth, () => {
  requestAnimationFrame(() => {
    initCanvas()
    render()
  })
})

// 添加计算单元格内容宽度的方法
const measureCellWidth = (column, context) => {
  if (!context) return 150
  
  // 计算表头宽度
  const headerWidth = context.measureText(column.title).width + 40
  
  // 计算所有单元格内容的最大宽度
  let maxContentWidth = 0
  const visibleStartIndex = Math.floor(scrollTop.value / props.rowHeight)
  const visibleEndIndex = Math.min(
    props.data.length,
    Math.ceil((scrollTop.value + tableContainer.value.clientHeight) / props.rowHeight)
  )
  
  // 只计算可见区域的单元格，避免性能问题
  for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
    const content = String(props.data[i][column.key])
    const contentWidth = context.measureText(content).width + 40 // 40px 为左右padding
    maxContentWidth = Math.max(maxContentWidth, contentWidth)
  }
  
  // 返回表头宽度和内容宽度中的较大值
  return Math.max(headerWidth, maxContentWidth, 150) // 最小 150px
}

// 修改 columnWidths 计算
const columnWidths = computed(() => {
  const context = ctx.value
  if (!context) return {}
  
  context.font = '14px Arial'
  const widths = {}
  
  // 1. 首先计算固定宽度和最小宽度
  let totalFixedWidth = 0
  let flexColumns = []
  
  props.columns.forEach((column, index) => {
    if (column.width) {
      widths[index] = column.width
      totalFixedWidth += column.width
    } else {
      // 使用新的measureCellWidth方法计算最小宽度
      const minWidth = measureCellWidth(column, context)
      widths[index] = minWidth
      totalFixedWidth += minWidth
      flexColumns.push(index)
    }
  })
  
  // 2. 如果总宽度小于容器宽度，分配剩余空间给弹性列
  const availableWidth = containerWidth.value - (showScrollbar.value ? 12 : 0)
  if (flexColumns.length > 0 && totalFixedWidth < availableWidth) {
    const extraSpace = availableWidth - totalFixedWidth
    const extraPerColumn = Math.floor(extraSpace / flexColumns.length)
    
    flexColumns.forEach(index => {
      widths[index] += extraPerColumn
    })
  }
  
  return widths
})

// 修改总宽度计算
const totalWidth = computed(() => {
  return props.columns.reduce((sum, _, index) => {
    return sum + columnWidths.value[index]
  }, 0)
})

// 添加计算属性判断是否需要显示滚动条
const showScrollbar = computed(() => {
  const contentHeight = props.data.length * props.rowHeight
  const containerHeight = tableContainer.value?.clientHeight - props.headerHeight || 0
  return contentHeight > containerHeight
})

// 添加 ResizeObserver 引用
const resizeObserver = ref(null)

// 添加横向滚动条相关的响应式变量
const showHorizontalScrollbar = computed(() => {
  return totalWidth.value > containerWidth.value
})

const horizontalThumbWidth = computed(() => {
  if (!containerWidth.value || !totalWidth.value) return 40
  const ratio = containerWidth.value / totalWidth.value
  return Math.max(40, ratio * (containerWidth.value - (showScrollbar.value ? 12 : 0)))
})

const horizontalThumbPosition = computed(() => {
  if (!containerWidth.value || !totalWidth.value) return 0
  const scrollableWidth = containerWidth.value - (showScrollbar.value ? 12 : 0) - horizontalThumbWidth.value
  const maxScroll = totalWidth.value - containerWidth.value
  return maxScroll <= 0 ? 0 : (scrollLeft.value / maxScroll) * scrollableWidth
})

// 添加横向滚动条拖动处理方法
const isDraggingHorizontalScroll = ref(false)
const startDragX = ref(0)
const startScrollLeft = ref(0)

const handleHorizontalScrollStart = (e) => {
  e.preventDefault() // 防止文本选择
  isDraggingHorizontalScroll.value = true
  startDragX.value = e.clientX
  startScrollLeft.value = scrollLeft.value
  
  window.addEventListener('mousemove', handleHorizontalScrollMove)
  window.addEventListener('mouseup', handleHorizontalScrollEnd)
}

const handleHorizontalScrollMove = (e) => {
  if (!isDraggingHorizontalScroll.value) return
  
  const deltaX = e.clientX - startDragX.value
  const scrollableWidth = containerWidth.value - (showScrollbar.value ? 12 : 0) - horizontalThumbWidth.value
  const maxScroll = totalWidth.value - containerWidth.value
  
  if (maxScroll <= 0) return
  
  const scrollRatio = maxScroll / scrollableWidth
  const newScrollLeft = startScrollLeft.value + deltaX * scrollRatio
  
  scrollLeft.value = Math.max(0, Math.min(newScrollLeft, maxScroll))
  render()
}

const handleHorizontalScrollEnd = () => {
  isDraggingHorizontalScroll.value = false
  window.removeEventListener('mousemove', handleHorizontalScrollMove)
  window.removeEventListener('mouseup', handleHorizontalScrollEnd)
}

onMounted(() => {
  // 使用 nextTick 确保 DOM 已更新
  nextTick(() => {
    if (tableContainer.value) {
      containerWidth.value = tableContainer.value.getBoundingClientRect().width
      
      // 创建 ResizeObserver
      resizeObserver.value = new ResizeObserver(entries => {
        const entry = entries[0]
        if (entry) {
          containerWidth.value = entry.contentRect.width
          
          // 重新计算列宽
          if (!props.columns.some(col => col.width)) {
            state.value.columnWidths = {}
          }
          
          // 重新初始化和渲染
          requestAnimationFrame(() => {
            initCanvas()
            render()
          })
        }
      })
      
      // 开始观察容器尺寸变化
      resizeObserver.value.observe(tableContainer.value)
      
      // 初始化
      initCanvas()
      render()
    }
  })
  
  // 初始化时检查是否需要显示横向滚动条
  if (totalWidth.value > containerWidth.value) {
    showHorizontalScrollbar.value = true
  }
})

onUnmounted(() => {
  // 停止观察并清理 ResizeObserver
  if (resizeObserver.value) {
    resizeObserver.value.disconnect()
  }
  
  // 移除其他事件监听
  window.removeEventListener('mousemove', handleScrollMove)
  window.removeEventListener('mouseup', handleScrollEnd)
  window.removeEventListener('mousemove', handleHorizontalScrollMove)
  window.removeEventListener('mouseup', handleHorizontalScrollEnd)
})

// 修改 initCanvas 方法
const initCanvas = () => {
  if (!tableContainer.value || !tableCanvas.value) return
  
  const canvas = tableCanvas.value
  // 只在首次初始化时获取 context
  if (!ctx.value) {
    ctx.value = canvas.getContext('2d')
  }
  
  const dpr = window.devicePixelRatio
  const width = Math.max(totalWidth.value, containerWidth.value - (showScrollbar.value ? 12 : 0))
  const height = tableContainer.value.getBoundingClientRect().height
  
  if (width <= 0 || height <= 0) return // 添加尺寸检查
  
  // 更新 canvas 尺寸
  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  
  // 设置 context scale
  ctx.value.scale(dpr, dpr)
}

// 添加防抖函数
const debounce = (fn, delay) => {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}

// 使用防抖包装 render 函数
const debouncedRender = debounce(() => {
  render()
}, 16)

const render = () => {
  if (!ctx.value || !tableCanvas.value) return
  
  requestAnimationFrame(() => {
    const context = ctx.value
    context.clearRect(0, 0, tableCanvas.value.width, tableCanvas.value.height)
    
    // 1. 绘制选中行高亮
    if (selectedRow.value !== null) {
      drawHighlightRow(selectedRow.value, 'rgba(24, 144, 255, 0.1)')
    }
    
    // 2. 绘制悬停行高亮
    if (hoveredRow.value !== null && hoveredRow.value !== selectedRow.value) {
      drawHighlightRow(hoveredRow.value, 'rgba(0, 0, 0, 0.02)')
    }
    
    // 3. 绘制数据行
    drawRows()
    
    // 4. 最后绘制表头，确保表头始终在最上层
    drawHeaders()
  })
}

const drawHeaders = () => {
  const context = ctx.value
  let x = 0
  
  context.fillStyle = '#f5f5f5'
  context.fillRect(0, 0, totalWidth.value, props.headerHeight)
  
  props.columns.forEach((column, index) => {
    const width = columnWidths.value[index]
    
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
      const width = columnWidths.value[columnIndex]
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
        const lineHeight = 20 // 行高
        const maxLines = Math.floor((props.rowHeight - padding * 2) / lineHeight) // 最大行数
        
        let lines = []
        let currentLine = ''
        let words = text.split(/(?<=[\u4e00-\u9fa5])|(?=[\u4e00-\u9fa5])|(?<=\s)|(?=\s)/) // 按中文字符和空格分割
        
        // 计算每一行的文本
        for (let word of words) {
          const testLine = currentLine + word
          const testWidth = context.measureText(testLine).width
          
          if (testWidth > maxWidth && currentLine) {
            lines.push(currentLine)
            currentLine = word
            
            // 检查是否超出最大行数
            if (lines.length >= maxLines) {
              if (words.length > words.indexOf(word) + 1) {
                // 如果还有更多文本，在最后一行添加省略号
                while (context.measureText(currentLine + '...').width > maxWidth) {
                  currentLine = currentLine.slice(0, -1)
                }
                currentLine += '...'
              }
              break
            }
          } else {
            currentLine += word
          }
        }
        
        // 添加最后一行
        if (currentLine && lines.length < maxLines) {
          lines.push(currentLine)
        }
        
        // 计算文本垂直居中的起始位置
        const totalTextHeight = lines.length * lineHeight
        let startY = y + (props.rowHeight - totalTextHeight) / 2
        
        // 绘制所有行
        lines.forEach((line, index) => {
          context.fillText(line, x + padding, startY + index * lineHeight + lineHeight / 2)
        })
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
  
  // 处理行选择 - 添加有效行判断
  if (offsetY > props.headerHeight) {
    const rowIndex = Math.floor((offsetY - props.headerHeight + scrollTop.value) / props.rowHeight)
    if (rowIndex < props.data.length) { // 只在点击有效行时设置选中状态
      selectedRow.value = rowIndex
      render()
    } else {
      selectedRow.value = null // 点击空白处清除选中状态
      render()
    }
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
  
  // 更新悬停状态 - 添加有效行判断
  const cell = getCellFromPoint(offsetX, offsetY)
  if (cell && cell.rowIndex < props.data.length) { // 只在有效行上显示悬停效果
    hoveredRow.value = cell.rowIndex
  } else {
    hoveredRow.value = null
  }
  
  // 处理 tooltip
  if (cell && props.showEllipsis) {
    const text = String(props.data[cell.rowIndex]?.[props.columns[cell.columnIndex].key] ?? '')
    const width = columnWidths.value[cell.columnIndex]
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

// 修改滚动处理，使用防抖的渲染
const handleWheel = (e) => {
  e.preventDefault()
  const containerHeight = tableContainer.value.clientHeight - props.headerHeight
  const contentHeight = props.data.length * props.rowHeight
  
  if (e.shiftKey || (e.deltaX !== 0 && totalWidth.value > containerWidth.value)) {
    const maxScroll = totalWidth.value - containerWidth.value
    const newScrollLeft = scrollLeft.value + (e.deltaX || e.deltaY)
    scrollLeft.value = Math.max(0, Math.min(newScrollLeft, maxScroll))
  } else {
    const maxScroll = contentHeight - containerHeight
    const newScrollTop = scrollTop.value + e.deltaY
    scrollTop.value = Math.max(0, Math.min(newScrollTop, maxScroll))
  }
  
  debouncedRender()
}

// 工具函数
const isNearColumnBorder = (x, y) => {
  if (y > props.headerHeight) return false
  
  let currentX = 0
  for (let i = 0; i < props.columns.length; i++) {
    currentX += columnWidths.value[i]
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
    const width = columnWidths.value[i]
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
  
  // 创建裁剪区域，排除表头
  context.save() // 保存当前上下文状态
  context.beginPath()
  context.rect(0, props.headerHeight, totalWidth.value, tableCanvas.value.height - props.headerHeight)
  context.clip() // 设置裁剪区域
  
  // 绘制高亮背景
  context.fillStyle = color
  context.fillRect(0, y, totalWidth.value, props.rowHeight)
  
  context.restore() // 恢复上下文状态
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
  if (!isDraggingScroll.value || !tableContainer.value) return
  
  const deltaY = e.clientY - startDragY.value
  const containerHeight = tableContainer.value.clientHeight - props.headerHeight
  const contentHeight = props.data.length * props.rowHeight
  const scrollableHeight = containerHeight - thumbHeight.value
  
  if (scrollableHeight <= 0) return
  
  const scrollRatio = (contentHeight - containerHeight) / scrollableHeight
  const newScrollTop = startScrollTop.value + deltaY * scrollRatio
  
  scrollTop.value = Math.max(0, Math.min(newScrollTop, contentHeight - containerHeight))
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

// 添加水平滚动相关变量
const scrollLeft = ref(0)
</script>

<style scoped>
.canvas-table {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.canvas-wrapper {
  position: relative;
  height: 100%;
  margin-right: v-bind("showScrollbar ? '12px' : 0");
  margin-bottom: v-bind("showHorizontalScrollbar ? '12px' : 0");
  transition: transform 0.1s ease-out;
}

canvas {
  display: block;
}

.scrollbar-track {
  position: absolute;
  right: 0;
  top: 0;
  bottom: v-bind("showHorizontalScrollbar ? '12px' : 0");
  width: 12px;
  background-color: #f5f5f5;
  border-left: 1px solid #e8e8e8;
  z-index: 1;
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

.horizontal-scrollbar-track {
  position: absolute;
  left: 0;
  right: v-bind("showScrollbar ? '12px' : 0");
  bottom: 0;
  height: 12px;
  background-color: #f5f5f5;
  border-top: 1px solid #e8e8e8;
  z-index: 1;
}

.horizontal-scrollbar-thumb {
  position: absolute;
  height: 8px;
  top: 2px;
  border-radius: 4px;
  background-color: #c1c1c1;
  cursor: pointer;
  transition: background-color 0.2s;
  user-select: none;
}

.horizontal-scrollbar-thumb:hover {
  background-color: #a1a1a1;
}

.horizontal-scrollbar-thumb:active {
  background-color: #909090;
}
</style> 