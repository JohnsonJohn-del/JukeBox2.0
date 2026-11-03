'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Crown, LogOut, SkipForward, UserCog } from 'lucide-react';
import { useRoomStore } from '@/store/roomStore';
import { useRoom } from '@/hooks/useRoom';
import { useSocket } from '@/hooks/useSocket';
import { SOCKET_EVENTS } from '@/sockets/events';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function HostControls({ className }: { className?: string }) {
  const { room, members, isHost } = useRoomStore();
  const { leaveRoom, transferHost } = useRoom(room?.id);
  const { socket } = useSocket();
  const [showEndRoom, setShowEndRoom] = useState(false);

  const handleEndRoom = useCallback(() => {
    if (room?.id) {
      socket.emit('close_room', { roomId: room.id });
      socket.emit(SOCKET_EVENTS.LEAVE_ROOM, { roomId: room.id, endRoom: true });
    }
    leaveRoom();
    setShowEndRoom(false);
  }, [room?.id, socket, leaveRoom]);

  const handleSkip = useCallback(() => {
    if (room?.id) {
      socket.emit(SOCKET_EVENTS.NEXT_TRACK, { roomId: room.id });
    }
  }, [room?.id, socket]);

  const nonHostMembers = members.filter((m) => !m.isHost);

  if (!isHost) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex items-center gap-2', className)}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20">
        <Crown className="w-3.5 h-3.5 text-yellow-400" />
        <span className="text-xs text-yellow-400 font-medium">Host</span>
      </div>

      <div className="h-5 w-px bg-black/15 dark:bg-white/10" />

      <Button
        variant="ghost"
        size="sm"
        onClick={handleSkip}
        className="font-button h-8 px-2.5 text-black/55 hover:bg-black/10 hover:text-black dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
        title="Skip track"
      >
        <SkipForward className="w-4 h-4" />
        <span className="text-xs ml-1 hidden sm:inline">Skip</span>
      </Button>

      {nonHostMembers.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-white/40 hover:text-white hover:bg-white/10 h-8 px-2.5"
              title="Transfer host"
            >
              <UserCog className="w-4 h-4" />
              <span className="text-xs ml-1 hidden sm:inline">Transfer</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-[#1a122e] border-white/10 text-white min-w-[160px]"
          >
            {nonHostMembers.map((member) => (
              <DropdownMenuItem
                key={member.userId}
                onClick={() => transferHost(member.userId)}
                className="hover:bg-white/10 cursor-pointer text-white/80 text-sm"
              >
                {member.nickname}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowEndRoom(true)}
        className="text-red-400/50 hover:text-red-400 hover:bg-red-500/10 h-8 px-2.5"
        title="End room"
      >
        <LogOut className="w-4 h-4" />
        <span className="text-xs ml-1 hidden sm:inline">End Room</span>
      </Button>

      <Dialog open={showEndRoom} onOpenChange={setShowEndRoom}>
        <DialogContent className="bg-[#1a122e] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>End Room</DialogTitle>
            <DialogDescription className="text-white/50">
              This will disconnect all members and close the room. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowEndRoom(false)}
              className="text-white/60 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleEndRoom}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              End Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
