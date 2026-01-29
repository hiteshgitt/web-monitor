import { useState, useRef, useCallback } from 'react';

export const useDragAndDrop = (items, onReorder) => {
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragStartPos = useRef(null);

  const handleDragStart = useCallback((index, e) => {
    setDraggedItem(index);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', '');
  }, []);

  const handleDragOver = useCallback((index, e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedItem !== null && draggedItem !== index) {
      setDragOverIndex(index);
    }
  }, [draggedItem]);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((index, e) => {
    e.preventDefault();
    if (draggedItem !== null && draggedItem !== index && onReorder) {
      const newItems = [...items];
      const [removed] = newItems.splice(draggedItem, 1);
      newItems.splice(index, 0, removed);
      onReorder(newItems);
    }
    setDraggedItem(null);
    setDragOverIndex(null);
  }, [draggedItem, items, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverIndex(null);
  }, []);

  return {
    draggedItem,
    dragOverIndex,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  };
};

export default useDragAndDrop;
