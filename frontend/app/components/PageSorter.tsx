import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, FileText } from 'lucide-react';

interface Page {
  id: string;
  content: string;
}

interface PageItemProps {
  id: string;
  index: number;
  content: string;
  isOverlay?: boolean;
}

const PageItem = ({ id, index, content, isOverlay }: PageItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex flex-col gap-2 p-2 mb-4 bg-transparent transition-all duration-200 ${
        isOverlay 
          ? 'scale-105 z-50' 
          : isDragging 
            ? 'opacity-30' 
            : 'hover:translate-x-1'
      }`}
    >
      <div className="flex items-center justify-between px-1">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${
          isOverlay ? 'text-purple-600' : 'text-gray-400 group-hover:text-purple-500'
        }`}>
          Page {index + 1}
        </span>
        <div
          {...attributes}
          {...listeners}
          className={`p-1 rounded cursor-grab active:cursor-grabbing transition-colors ${
            isOverlay ? 'text-purple-600' : 'text-gray-300 group-hover:text-purple-400 hover:bg-gray-100'
          }`}
        >
          <GripVertical size={14} />
        </div>
      </div>

      {/* Visual Thumbnail Container */}
      <div className={`relative mx-auto w-[140px] aspect-[1/1.414] bg-white border rounded-sm overflow-hidden transition-all duration-300 ${
        isOverlay 
          ? 'border-purple-500 shadow-2xl ring-2 ring-purple-100 scale-110' 
          : 'border-gray-200 shadow-sm group-hover:border-purple-300 group-hover:shadow-md'
      }`}>
        {/* The "Scaled" Content - No font-size overrides, just pure scaling */}
        <div 
          className="absolute top-0 left-0 origin-top-left pointer-events-none select-none"
          style={{ 
            width: '210mm', 
            height: '297mm',
            transform: 'scale(0.176)', // 140px / 794px (210mm at 96dpi)
            padding: '2.54cm',
          }}
        >
          <div 
            className="ProseMirror" // Use the same class as the editor
            dangerouslySetInnerHTML={{ __html: content }} 
          />
        </div>
        
        {/* Subtle paper texture/overlay */}
        <div className="absolute inset-0 bg-white/10 pointer-events-none" />
      </div>

      {isOverlay && (
        <div className="absolute -inset-2 bg-purple-50/50 rounded-xl -z-10 animate-pulse" />
      )}
    </div>
  );
};

interface PageSorterProps {
  pages: Page[];
  onReorder: (oldIndex: number, newIndex: number) => void;
}

const PageSorter = ({ pages, onReorder }: PageSorterProps) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: {
            distance: 8, // Avoid accidental drags
        },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = pages.findIndex(p => p.id === active.id);
      const newIndex = pages.findIndex(p => p.id === over.id);
      onReorder(oldIndex, newIndex);
    }
    setActiveId(null);
  };

  const activePage = activeId ? pages.find(p => p.id === activeId) : null;
  const activeIndex = activePage ? pages.findIndex(p => p.id === activeId) : -1;

  return (
    <div className="w-64 flex-shrink-0 bg-gray-50 border-r border-gray-200 overflow-y-auto h-full p-4 hidden lg:block select-none scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300">
      <div className="flex items-center gap-2 mb-6 px-1">
        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest">
          Page Sorter
        </h2>
        <span className="ml-auto text-[10px] font-medium text-gray-400 bg-gray-200/50 px-1.5 py-0.5 rounded-full">
          {pages.length}
        </span>
      </div>
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext
          items={pages.map(p => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {pages.map((page, index) => (
            <PageItem 
              key={page.id} 
              id={page.id} 
              index={index} 
              content={page.content} 
            />
          ))}
        </SortableContext>

        <DragOverlay adjustScale={false} dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: '0.3',
              },
            },
          }),
        }}>
          {activeId && activePage ? (
            <PageItem 
              id={activeId} 
              index={activeIndex} 
              content={activePage.content} 
              isOverlay 
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default PageSorter;