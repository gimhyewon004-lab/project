/**
 * Schedule & Task Management Controller
 * Handles Todo CRUD, completion toggles, anti-duplicate reward checks,
 * daily completion rate calculations, and 7-day streak/history tracking.
 */

import { db } from './db.js';

export const CATEGORIES = {
  cat: { label: '고양이 돌보기', icon: '🐾', color: '#E07A5F', bg: '#FDF0EC' },
  work: { label: '업무', icon: '💼', color: '#3D405B', bg: '#ECEEF4' },
  study: { label: '공부', icon: '📚', color: '#4D8B71', bg: '#EAF4EF' },
  workout: { label: '운동', icon: '🏃', color: '#D47339', bg: '#FAECE4' },
  daily: { label: '일상', icon: '🌿', color: '#6A8EAE', bg: '#EDF3F7' },
  hobby: { label: '취미', icon: '🎨', color: '#8F5C9E', bg: '#F7EDF9' }
};

export const PRIORITIES = {
  high: { label: '높음', icon: '🔥', color: '#E63946' },
  medium: { label: '보통', icon: '⭐️', color: '#F4A261' },
  low: { label: '낮음', icon: '⚡️', color: '#81B29A' }
};

export class ScheduleController {
  constructor() {
    this.currentDate = this.getTodayDateString();
    this.schedules = [];
    this.onRewardTriggered = null; // Callback when a new sticker reward is earned
  }

  getTodayDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async loadDate(dateStr) {
    this.currentDate = dateStr;
    this.schedules = await db.getSchedulesByDate(dateStr);
    return this.schedules;
  }

  async addTask(data) {
    const newTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      date: data.date || this.currentDate,
      time: data.time || '',
      title: data.title.trim(),
      category: data.category || 'daily',
      priority: data.priority || 'medium',
      completed: false,
      rewardClaimed: false, // Prevents duplicate rewards
      createdAt: new Date().toISOString()
    };

    await db.saveSchedule(newTask);
    if (newTask.date === this.currentDate) {
      this.schedules.push(newTask);
    }
    return newTask;
  }

  async updateTask(id, updates) {
    const all = await db.getAllSchedules();
    const task = all.find(t => t.id === id);
    if (!task) return null;

    Object.assign(task, updates);
    await db.saveSchedule(task);

    if (task.date === this.currentDate) {
      const idx = this.schedules.findIndex(t => t.id === id);
      if (idx >= 0) this.schedules[idx] = task;
    }
    return task;
  }

  async deleteTask(id) {
    await db.deleteSchedule(id);
    this.schedules = this.schedules.filter(t => t.id !== id);
  }

  /**
   * Toggle task completion status
   * Triggers sticker reward ONLY once per task (rewardClaimed check)
   */
  async toggleTask(id) {
    const all = await db.getAllSchedules();
    const task = all.find(t => t.id === id);
    if (!task) return { task: null, rewarded: false };

    task.completed = !task.completed;
    let rewarded = false;

    // Check reward condition: must be newly completed and reward not yet claimed
    if (task.completed && !task.rewardClaimed) {
      task.rewardClaimed = true;
      rewarded = true;
      if (typeof this.onRewardTriggered === 'function') {
        this.onRewardTriggered(task);
      }
    }

    await db.saveSchedule(task);

    // Update local cache
    const idx = this.schedules.findIndex(t => t.id === id);
    if (idx >= 0) {
      this.schedules[idx] = task;
    }

    return { task, rewarded };
  }

  /**
   * Calculate daily completion rate and cheery cat message
   */
  async getDailyProgress(dateStr = this.currentDate) {
    const list = await db.getSchedulesByDate(dateStr);
    const total = list.length;
    const completed = list.filter(t => t.completed).length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    let message = '오늘의 일정을 등록하고 고양이 스티커를 모아보세요! 🐾';
    let catMood = 'sleepy';

    if (total > 0) {
      if (percentage === 100) {
        message = '🎉 완벽해요! 오늘의 모든 일정을 달성했습니다! 😻';
        catMood = 'ecstatic';
      } else if (percentage >= 70) {
        message = '✨ 아주 훌륭해요! 고양이가 흐뭇하게 골골송을 불러요! 😸';
        catMood = 'happy';
      } else if (percentage >= 35) {
        message = '💪 차근차근 잘하고 있어요! 고양이가 젤리로 응원합니다! 🐾';
        catMood = 'encouraged';
      } else {
        message = '🌱 시작이 반이에요! 첫 번째 일정을 완료해 볼까요? 😺';
        catMood = 'waiting';
      }
    }

    return {
      total,
      completed,
      percentage,
      message,
      catMood
    };
  }

  /**
   * Get 7-day achievement history leading up to reference date
   */
  async getRecent7DaysRecord(refDateStr = this.currentDate) {
    const all = await db.getAllSchedules();
    const [year, month, day] = refDateStr.split('-').map(Number);
    const refDate = new Date(year, month - 1, day);

    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    const days = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(refDate);
      d.setDate(d.getDate() - i);

      const dYear = d.getFullYear();
      const dMonth = String(d.getMonth() + 1).padStart(2, '0');
      const dDay = String(d.getDate()).padStart(2, '0');
      const dateString = `${dYear}-${dMonth}-${dDay}`;

      const dayTasks = all.filter(t => t.date === dateString);
      const total = dayTasks.length;
      const completed = dayTasks.filter(t => t.completed).length;
      const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

      days.push({
        date: dateString,
        displayDate: `${d.getMonth() + 1}/${d.getDate()}`,
        dayName: weekDays[d.getDay()],
        total,
        completed,
        percentage: pct,
        isToday: dateString === this.getTodayDateString(),
        isCurrentSelected: dateString === refDateStr
      });
    }

    // Calculate streak (consecutive days with 100% or at least 1 completed task)
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].completed > 0) {
        streak++;
      } else if (days[i].isToday && days[i].total === 0) {
        // If today has no tasks yet, don't break yesterday's streak
        continue;
      } else {
        break;
      }
    }

    return {
      days,
      streak,
      totalCompletedWeek: days.reduce((sum, d) => sum + d.completed, 0)
    };
  }
}

export const scheduleController = new ScheduleController();
