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
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SafeImage } from '../SafeImage';
import {
  GripVertical,
  Trash2,
  ChevronUp,
  ChevronDown,
  ShoppingBag,
  Calendar,
  Image as ImageIcon,
  Link2
} from 'lucide-react';
import { Locale } from '../../types';
import { PremiumMark } from '../brand/PremiumMark';

export interface StudioBlockItem {
  id: string;
  title: string;
  url: string;
  subtitle?: string;
  type?: 'link' | 'gallery' | 'booking' | 'shop' | string;
  thumbnail?: string;
}

interface SortableBlockListProps {
  items: StudioBlockItem[];
  onChange: (items: StudioBlockItem[]) => void;
  onRemove: (id: string) => void;
  locale: Locale;
}

/**
 * Returns icon, color, and localized label for each block category
 */
function getBlockTypeMeta(type: string = 'link', isRtl: boolean) {
  switch (type) {
    case 'shop':
      return {
        icon: ShoppingBag,
        label: isRtl ? 'منتج / متجر' : 'Shop / Product',
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
      };
    case 'booking':
      return {
        icon: Calendar,
        label: isRtl ? 'حجز موعد' : 'Booking / Event',
        badgeBg: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800'
      };
    case 'gallery':
      return {
        icon: ImageIcon,
        label: isRtl ? 'معرض وسائط' : 'Media / Gallery',
        badgeBg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
      };
    case 'link':
    default:
      return {
        icon: Link2,
        label: isRtl ? 'رابط' : 'Link',
        badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
      };
  }
}

/**
 * Visual presentation card for a single block
 */
interface BlockCardViewProps {
  item: StudioBlockItem;
  index: number;
  total: number;
  isRtl: boolean;
  isDragging?: boolean;
  dragHandleProps?: Record<string, any>;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

const BlockCardView: React.FC<BlockCardViewProps> = ({
  item,
  index,
  total,
  isRtl,
  isDragging = false,
  dragHandleProps,
  onRemove,
  onMoveUp,
  onMoveDown
}) => {
  const meta = getBlockTypeMeta(item.type, isRtl);
  const IconComp = meta.icon;

  return (
    <div
      className={`group relative p-3 sm:p-3.5 bg-white rounded-2xl border transition-all duration-200 flex items-center gap-2.5 sm:gap-3 ${
        isDragging
          ? 'shadow-2xl ring-2 ring-indigo-500 border-indigo-400 bg-white scale-[1.02] z-50'
          : 'border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-xs'
      }`}
    >
      {/* Drag & Drop Grip Handle */}
      <button
        type="button"
        {...dragHandleProps}
        className="touch-none p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 transition-colors cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
        aria-label={isRtl ? `اسحب لإعادة ترتيب ${item.title}` : `Drag to reorder ${item.title}`}
        title={isRtl ? 'اسحب لإعادة الترتيب' : 'Drag to reorder'}
      >
        <GripVertical className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
      </button>

      {/* Sequence Order Badge */}
      <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-black flex items-center justify-center shrink-0 select-none">
        #{index + 1}
      </span>

      {/* Visual Thumbnail or Type Icon Avatar */}
      <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
        {item.thumbnail ? (
          <SafeImage
            src={item.thumbnail}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-indigo-50/70 text-indigo-600">
            <IconComp className="w-5 h-5" />
          </div>
        )}
      </div>

      {/* Block Information */}
      <div className="flex-1 min-w-0 pr-1 rtl:pr-0 rtl:pl-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-xs sm:text-[13px] text-slate-900 truncate max-w-[160px] sm:max-w-[220px]">
            {item.title}
          </span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border flex items-center gap-1 ${meta.badgeBg}`}
          >
            <IconComp className="w-2.5 h-2.5" />
            <span>{meta.label}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 truncate">
          <span className="font-mono text-[10px] text-slate-400 truncate max-w-[140px] sm:max-w-[220px]">
            {item.url}
          </span>
          {item.subtitle && (
            <>
              <span className="text-slate-300">•</span>
              <span className="truncate max-w-[120px] text-slate-500">
                {item.subtitle}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Position Quick Arrows (Accessible Fallback / Mobile Taps) */}
      <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
        {onMoveUp && (
          <button
            type="button"
            disabled={index === 0}
            onClick={onMoveUp}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-25 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"
            aria-label={isRtl ? 'تحريك للأعلى' : 'Move up'}
            title={isRtl ? 'تحريك للأعلى' : 'Move up'}
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        )}
        {onMoveDown && (
          <button
            type="button"
            disabled={index === total - 1}
            onClick={onMoveDown}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-25 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"
            aria-label={isRtl ? 'تحريك للأسفل' : 'Move down'}
            title={isRtl ? 'تحريك للأسفل' : 'Move down'}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Remove Block Action */}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
          aria-label={isRtl ? `حذف ${item.title}` : `Remove ${item.title}`}
          title={isRtl ? 'حذف العنصر' : 'Remove block'}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

/**
 * Sortable Item Wrapper connecting dnd-kit hooks to BlockCardView
 */
interface SortableItemWrapperProps {
  item: StudioBlockItem;
  index: number;
  total: number;
  isRtl: boolean;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const SortableItemWrapper: React.FC<SortableItemWrapperProps> = ({
  item,
  index,
  total,
  isRtl,
  onRemove,
  onMoveUp,
  onMoveDown
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'opacity-40 pointer-events-none' : ''}
    >
      <BlockCardView
        item={item}
        index={index}
        total={total}
        isRtl={isRtl}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
        onRemove={onRemove}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />
    </div>
  );
};

export const SortableBlockList: React.FC<SortableBlockListProps> = ({
  items,
  onChange,
  onRemove,
  locale
}) => {
  const isRtl = locale === 'ar';
  const [activeId, setActiveId] = useState<string | null>(null);

  // Configure pointer and keyboard sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // Require moving 5px before starting drag so clicks on buttons or links are never blocked
        distance: 5
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onChange(arrayMove(items, oldIndex, newIndex));
      }
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      onChange(arrayMove(items, index, index - 1));
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < items.length - 1) {
      onChange(arrayMove(items, index, index + 1));
    }
  };

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;
  const activeIndex = activeItem ? items.findIndex((i) => i.id === activeItem.id) : 0;

  if (items.length === 0) {
    return (
      <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
        <PremiumMark className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-xs font-bold text-slate-600">
          {isRtl ? 'لا توجد عناصر مضافة بعد' : 'No components or links added yet'}
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {isRtl
            ? 'استخدم النموذج أعلاه لإضافة روابط، منتجات أو حجز مواعيد.'
            : 'Use the form above to add links, products, galleries, or booking cards.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Reordering Hint & Count Header */}
      <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 mb-1 select-none">
        <span className="font-bold flex items-center gap-1.5 text-slate-700">
          <GripVertical className="w-3.5 h-3.5 text-indigo-500" />
          <span>
            {isRtl ? 'ترتيب المكونات والروابط' : 'Arranged Components & Links'}
          </span>
          <span className="px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px] border border-indigo-100">
            {items.length}
          </span>
        </span>
        <span className="text-[10px] text-slate-400 hidden sm:inline">
          {isRtl ? 'اسحب المقبض لإعادة الترتيب تلقائياً' : 'Drag handle to rearrange live order'}
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {items.map((item, idx) => (
              <SortableItemWrapper
                key={item.id}
                item={item}
                index={idx}
                total={items.length}
                isRtl={isRtl}
                onRemove={() => onRemove(item.id)}
                onMoveUp={() => handleMoveUp(idx)}
                onMoveDown={() => handleMoveDown(idx)}
              />
            ))}
          </div>
        </SortableContext>

        {/* Floating preview while item is being dragged */}
        <DragOverlay
          dropAnimation={{
            sideEffects: defaultDropAnimationSideEffects({
              styles: {
                active: {
                  opacity: '0.4'
                }
              }
            })
          }}
        >
          {activeItem ? (
            <BlockCardView
              item={activeItem}
              index={activeIndex}
              total={items.length}
              isRtl={isRtl}
              isDragging={true}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};
