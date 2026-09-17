import type { FC } from 'react'
import React, { useState, useEffect } from 'react'
import {
  Bars3Icon,
  PencilSquareIcon,
  PencilIcon,
} from '@heroicons/react/24/solid'
import AuthButton from '@/components/AuthButton'

export interface IHeaderProps {
  title: string
  isMobile?: boolean
  onShowSideBar?: () => void
  onCreateNewChat?: () => void
  onUpdateTitle?: (newTitle: string) => void
}
const Header: FC<IHeaderProps> = ({
  title,
  isMobile,
  onShowSideBar,
  onCreateNewChat,
  onUpdateTitle,
}) => {
const [isEditing, setIsEditing] = useState(false)
const [newTitle, setNewTitle] = useState(title)

  useEffect(() => {
    setNewTitle(title)
  }, [title])

  const handleSave = () => {
    setIsEditing(false)
    if (newTitle.trim() && newTitle !== title) {
      onUpdateTitle?.(newTitle.trim())
    } else {
      setNewTitle(title)
    }
  }
  return (
    <div className="shrink-0 flex items-center justify-between h-12 px-3 bg-gray-100">
      {isMobile
        ? (
          <div
            className='flex items-center justify-center h-8 w-8 cursor-pointer'
            onClick={() => onShowSideBar?.()}
          >
            <Bars3Icon className="h-4 w-4 text-gray-500" />
          </div>
        )
        : <div></div>}
      <div className='flex items-center space-x-2'>
        <img
          src="/logoarcahead.jpg"
          alt="ARCA Logo"
          className="w-6 h-6 object-contain rounded-md"
        />
        {isEditing ? (
      <input
        type="text"
        className="text-sm font-bold text-gray-800 bg-white border border-gray-300 rounded px-2 py-0.5 outline-none focus:border-blue-500"
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave()
          if (e.key === 'Escape') {
            setNewTitle(title)
            setIsEditing(false)
          }
        }}
        autoFocus
      />
    ) : (
      <div 
        className="flex items-center space-x-1 cursor-pointer group"
        onClick={() => setIsEditing(true)}
        title="Haz clic para editar el nombre"
      >
        <span className="text-sm text-gray-800 font-bold">{title}</span>
        <PencilIcon className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    )}
      </div>
      {isMobile
        ? (
          <div className='flex items-center justify-center h-8 w-8 cursor-pointer' onClick={() => onCreateNewChat?.()} >
            <PencilSquareIcon className="h-4 w-4 text-gray-500" />
          </div>)
        : <div></div>}
    </div>
  )
}

export default React.memo(Header)
