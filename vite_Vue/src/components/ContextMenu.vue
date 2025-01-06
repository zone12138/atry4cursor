<template>
  <div
    class="context-menu"
    :class="{ 'show-menu': visible }"
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
        v-model:visible="getMenuItemState(item.key).isOpen"
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
    isOpen: false,
  }))
})

// 存储所有菜单项的状态
const menuItemStates = ref(new Map())

// 初始化或获取菜单项状态
const getMenuItemState = (key) => {
  if (!menuItemStates.value.has(key)) {
    menuItemStates.value.set(key, { isOpen: false })
  }
  return menuItemStates.value.get(key)
}

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
    left: props.position.rightEnough ? '100%' : 'auto',
    right: props.position.rightEnough ? 'auto' : '100%'
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

  // 关闭同级的其他子菜单
  processedMenuItems.value.forEach(menuItem => {
    if (menuItem !== item && menuItem.children) {
      const state = getMenuItemState(menuItem.key)
      state.isOpen = false
    }
  })

  // 检查右侧空间是否足够
  const rightSpace = viewportWidth - rect.right
  const subMenuWidth = 160

  // 更新子菜单位置
  subMenuPositions.value[item.key] = {
    rightEnough: rightSpace >= subMenuWidth,
  }

  // 显示子菜单
  const state = getMenuItemState(item.key)
  state.isOpen = true
}

// 关闭所有子菜单
const closeAllSubMenus = () => {
  // 清空所有菜单项状态
  menuItemStates.value.clear()
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
  const isClickInMenu = (element) => {
    if (!element) return false
    if (element.classList.contains('context-menu')) return true
    return isClickInMenu(element.parentElement)
  }

  if (!isClickInMenu(event.target)) {
    closeMenu()
    // 确保清空所有状态
    menuItemStates.value.clear()
  }
}

// 监听菜单可见性变化
watch(() => props.visible, (newVal) => {
  if (!newVal) {
    // 菜单隐藏时清空所有状态
    menuItemStates.value.clear()
  }
})

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
  visibility: hidden;
}

.show-menu {
  visibility: visible;
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