<template>
  <div
    v-show="visible"
    class="context-menu"
    :style="menuStyle"
    @contextmenu.prevent
    ref="menuRef"
  >
    <div
      v-for="item in processedMenuItems"
      :key="item.key"
      class="menu-item"
      @click="handleClick(item)"
      @mouseenter="handleMouseEnter(item, $event)"
      ref="menuItemRefs"
    >
      <div class="menu-content">
        <span>{{ item.label }}</span>
        <span v-if="item.children" class="arrow">▶</span>
      </div>
      
      <ContextMenu
        v-if="item.children"
        v-model:visible="item.isOpen"
        :menu-items="item.children"
        :position="subMenuPositions[item.key]"
        :level="level + 1"
        @select="handleSelect"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  menuItems: {
    type: Array,
    default: () => []
  },
  position: {
    type: Object,
    default: () => ({ x: 0, y: 0 })
  },
  level: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['update:visible', 'select'])
const menuRef = ref(null)
const menuItemRefs = ref([])
const subMenuPositions = ref({})

// 处理菜单项数据，添加必要的响应式属性
const processedMenuItems = computed(() => {
  return props.menuItems.map(item => ({
    ...item,
    isOpen: false
  }))
})

// 计算菜单样式
const menuStyle = computed(() => {
  if (props.level === 0) {
    const { adjustedX, adjustedY } = calculateAdjustedPosition(
      props.position.x,
      props.position.y
    )
    return {
      left: `${adjustedX}px`,
      top: `${adjustedY}px`,
      position: 'fixed'
    }
  }
  return {
    position: 'absolute',
    top: 0,
    left: '100%'
  }
})

// 计算调整后的位置
const calculateAdjustedPosition = (x, y) => {
  if (!menuRef.value) return { adjustedX: x, adjustedY: y }

  const rect = menuRef.value.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  let adjustedX = x
  let adjustedY = y

  if (x + rect.width > viewportWidth) {
    adjustedX = viewportWidth - rect.width - 5
  }
  if (adjustedX < 0) {
    adjustedX = 5
  }

  if (y + rect.height > viewportHeight) {
    adjustedY = viewportHeight - rect.height - 5
  }
  if (adjustedY < 0) {
    adjustedY = 5
  }

  return { adjustedX, adjustedY }
}

// 处理鼠标进入事件
const handleMouseEnter = (item, event) => {
  if (!item.children) {
    closeAllSubMenus()
    return
  }

  const menuItem = event.currentTarget
  const rect = menuItem.getBoundingClientRect()
  const viewportWidth = window.innerWidth

  // 关闭其他子菜单
  processedMenuItems.value.forEach(menuItem => {
    if (menuItem !== item && menuItem.children) {
      menuItem.isOpen = false
    }
  })

  // 检查右侧空间是否足够
  const rightSpace = viewportWidth - rect.right
  const subMenuWidth = 160 // 子菜单宽度

  // 更新子菜单的样式
  const style = menuRef.value.style
  if (rightSpace < subMenuWidth) {
    // 右侧空间不足，向左展开
    style.left = 'auto'
    style.right = '100%'
  } else {
    // 右侧空间足够，向右展开
    style.left = '100%'
    style.right = 'auto'
  }

  // 更新子菜单位置
  subMenuPositions.value[item.key] = {}

  // 显示子菜单
  item.isOpen = true
}

// 关闭所有子菜单
const closeAllSubMenus = () => {
  processedMenuItems.value.forEach(item => {
    if (item.children) {
      item.isOpen = false
    }
  })
}

// 处理点击事件
const handleClick = (item) => {
  if (item.children) return
  emit('select', item)
  closeMenu()
}

// 处理子菜单选择
const handleSelect = (item) => {
  emit('select', item)
  closeMenu()
}

// 关闭菜单
const closeMenu = () => {
  emit('update:visible', false)
  closeAllSubMenus()
}

// 处理点击外部
const handleClickOutside = (event) => {
  if (menuRef.value && !menuRef.value.contains(event.target)) {
    closeMenu()
  }
}

onMounted(() => {
  if (props.level === 0) {
    document.addEventListener('mousedown', handleClickOutside)
  }
})

onUnmounted(() => {
  if (props.level === 0) {
    document.removeEventListener('mousedown', handleClickOutside)
  }
})
</script>

<style scoped>
.context-menu {
  background: white;
  min-width: 160px;
  padding: 5px 0;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  z-index: 9999;
  user-select: none;
}

.menu-item {
  position: relative;
  padding: 0 20px;
  height: 40px;
  line-height: 40px;
  cursor: pointer;
}

.menu-item:hover {
  background-color: #f5f7fa;
}

.menu-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.arrow {
  margin-left: 8px;
  font-size: 12px;
}
</style> 