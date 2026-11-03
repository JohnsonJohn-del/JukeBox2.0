import { Router } from 'express'
import * as roomController from '../controllers/room.controller'
import { authenticate, optionalAuth } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate.middleware'
import { createRoomSchema, joinRoomSchema, transferHostSchema } from '../validators/room.validator'

const router = Router()

router.post('/', authenticate, validate(createRoomSchema), roomController.createRoom)
router.post('/join', optionalAuth, validate(joinRoomSchema), roomController.joinRoom)
router.get('/', authenticate, roomController.getActiveRooms)
router.get('/code/:code', roomController.getRoomByCode)
router.get('/:id', roomController.getRoom)
router.post('/:id/leave', authenticate, roomController.leaveRoom)
router.post('/:id/transfer', authenticate, validate(transferHostSchema), roomController.transferHost)
router.post('/:id/end', authenticate, roomController.endRoom)
router.get('/:id/messages', authenticate, roomController.getRoomMessages)
router.post('/:id/messages', authenticate, roomController.sendRoomMessage)

export default router
