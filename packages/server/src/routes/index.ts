import { Router } from 'express'
import authRoutes from './auth.routes'
import roomRoutes from './room.routes'
import queueRoutes from './queue.routes'
import searchRoutes from './search.routes'
import systemRoutes from './system.routes'

const router = Router()

router.use('/auth', authRoutes)
router.use('/rooms', roomRoutes)
router.use('/rooms', queueRoutes)
router.use('/search', searchRoutes)
router.use('/system', systemRoutes)

export default router
