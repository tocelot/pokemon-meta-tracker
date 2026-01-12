'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CalendarEvent {
  id: string
  type: 'League Cup' | 'League Challenge'
  name: string
  date: string
  time: string
  city: string
  state: string
  shop: string
  address: string
  cost: string
  registrationUrl: string
  distance?: number
}

interface EventCalendarProps {
  events: CalendarEvent[]
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export function EventCalendar({ events, selectedDate, onSelectDate }: EventCalendarProps) {
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())

  // Check if we're viewing the current month
  const isCurrentMonthView = currentMonth === today.getMonth() && currentYear === today.getFullYear()

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {}
    for (const event of events) {
      if (!grouped[event.date]) {
        grouped[event.date] = []
      }
      grouped[event.date].push(event)
    }
    return grouped
  }, [events])

  // Get calendar grid data
  const calendarDays = useMemo(() => {
    const days: Array<{ date: number; dateString: string; isCurrentMonth: boolean }> = []

    const formatDateString = (d: Date) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    if (isCurrentMonthView) {
      // For current month: start from beginning of current week, show 3 weeks
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - today.getDay()) // Go to Sunday of current week

      // Show 3 weeks (21 days)
      for (let i = 0; i < 21; i++) {
        const d = new Date(startOfWeek)
        d.setDate(startOfWeek.getDate() + i)
        days.push({
          date: d.getDate(),
          dateString: formatDateString(d),
          isCurrentMonth: d.getMonth() === currentMonth
        })
      }
    } else {
      // For other months: show full month view
      const firstDay = new Date(currentYear, currentMonth, 1)
      const lastDay = new Date(currentYear, currentMonth + 1, 0)
      const daysInMonth = lastDay.getDate()
      const startingDayOfWeek = firstDay.getDay()

      // Previous month's trailing days
      const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate()
      for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        const date = prevMonthLastDay - i
        const month = currentMonth === 0 ? 11 : currentMonth - 1
        const year = currentMonth === 0 ? currentYear - 1 : currentYear
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`
        days.push({ date, dateString, isCurrentMonth: false })
      }

      // Current month's days
      for (let date = 1; date <= daysInMonth; date++) {
        const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`
        days.push({ date, dateString, isCurrentMonth: true })
      }

      // Next month's leading days - only fill to complete the last week
      const remainingDays = (7 - (days.length % 7)) % 7
      for (let date = 1; date <= remainingDays; date++) {
        const month = currentMonth === 11 ? 0 : currentMonth + 1
        const year = currentMonth === 11 ? currentYear + 1 : currentYear
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`
        days.push({ date, dateString, isCurrentMonth: false })
      }
    }

    return days
  }, [currentMonth, currentYear, isCurrentMonthView, today])

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const goToToday = () => {
    setCurrentMonth(today.getMonth())
    setCurrentYear(today.getFullYear())
    onSelectDate(null)
  }

  const isToday = (dateString: string) => {
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    return dateString === todayString
  }

  return (
    <div className="bg-poke-dark border border-gray-800 rounded-lg p-2 sm:p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          disabled={isCurrentMonthView}
          className={`p-2 rounded-lg transition-colors ${isCurrentMonthView ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-800'}`}
        >
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>

        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-white">
            {isCurrentMonthView ? 'Next 3 Weeks' : `${MONTHS[currentMonth]} ${currentYear}`}
          </h3>
          {!isCurrentMonthView && (
            <button
              onClick={goToToday}
              className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
            >
              Today
            </button>
          )}
        </div>

        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Days of week header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAYS_OF_WEEK.map(day => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => {
          const dayEvents = eventsByDate[day.dateString] || []
          const hasEvents = dayEvents.length > 0
          const isSelected = selectedDate === day.dateString
          const todayHighlight = isToday(day.dateString)
          const previewEvents = dayEvents.slice(0, 2)
          const moreCount = dayEvents.length - 2

          // Format time to compact 12-hour format
          const formatTime = (time: string) => {
            if (!time) return ''
            const [hours, minutes] = time.split(':')
            const hour = parseInt(hours)
            const ampm = hour >= 12 ? 'p' : 'a'
            const hour12 = hour % 12 || 12
            return `${hour12}${minutes !== '00' ? ':' + minutes : ''}${ampm}`
          }

          return (
            <button
              key={index}
              onClick={() => {
                if (hasEvents) {
                  onSelectDate(isSelected ? null : day.dateString)
                }
              }}
              disabled={!hasEvents}
              className={`
                relative min-h-[60px] sm:min-h-[80px] md:min-h-[100px] p-0.5 sm:p-1 flex flex-col items-stretch rounded-lg text-sm transition-all
                ${!day.isCurrentMonth ? 'text-gray-600 bg-gray-900/30' : 'text-gray-300'}
                ${hasEvents ? 'cursor-pointer hover:bg-gray-800' : 'cursor-default'}
                ${isSelected ? 'bg-gray-700 ring-2 ring-poke-blue' : ''}
                ${todayHighlight && !isSelected ? 'ring-1 ring-gray-500' : ''}
              `}
            >
              {/* Date number */}
              <span className={`
                text-xs self-end px-1 rounded
                ${todayHighlight ? 'font-bold text-white bg-poke-blue' : ''}
                ${hasEvents && !todayHighlight ? 'font-medium text-white' : ''}
              `}>
                {day.date}
              </span>

              {/* Event previews */}
              {hasEvents && (
                <div className="flex-1 flex flex-col gap-0.5 mt-1 overflow-hidden">
                  {previewEvents.map((event, i) => (
                    <div
                      key={i}
                      className={`
                        text-[8px] sm:text-[10px] leading-tight px-0.5 sm:px-1 py-0.5 rounded
                        ${event.type === 'League Cup'
                          ? 'bg-orange-500/20 text-orange-300'
                          : 'bg-poke-blue/20 text-blue-300'
                        }
                      `}
                      title={`${event.type}: ${event.shop} - ${event.city}`}
                    >
                      <div className="truncate">{event.city}</div>
                      <div className="text-[7px] sm:text-[9px] opacity-75 truncate hidden sm:block">
                        {formatTime(event.time)} · {event.shop.split(' ').slice(0, 2).join(' ')}
                      </div>
                    </div>
                  ))}
                  {moreCount > 0 && (
                    <div className="text-[10px] text-gray-500 px-1">
                      +{moreCount} more
                    </div>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span className="text-xs text-gray-400">League Cup</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-poke-blue" />
          <span className="text-xs text-gray-400">League Challenge</span>
        </div>
      </div>
    </div>
  )
}
