'use client'

import axios from 'axios'
import Cookies from 'js-cookie'

export const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(config => {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('fittrainly-auth')
    const token = raw ? JSON.parse(raw)?.state?.accessToken : null
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  r => r,
  async error => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = Cookies.get('fittrainly-refresh')
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken })
          const raw = localStorage.getItem('fittrainly-auth')
          if (raw) {
            const parsed = JSON.parse(raw)
            parsed.state.accessToken = data.accessToken
            localStorage.setItem('fittrainly-auth', JSON.stringify(parsed))
          }
          original.headers.Authorization = `Bearer ${data.accessToken}`
          return api(original)
        } catch {
          Cookies.remove('fittrainly-refresh')
          localStorage.removeItem('fittrainly-auth')
          window.location.href = '/login'
        }
      } else {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then(r => r.data),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }).then(r => r.data),
}

// Dashboard
export const dashboardApi = {
  admin: () => api.get('/dashboard').then(r => r.data),
  pt: () => api.get('/dashboard').then(r => r.data),
  aluno: () => api.get('/dashboard').then(r => r.data),
}

// Personal Trainers
export const ptApi = {
  list: () => api.get('/personal-trainers').then(r => r.data),
  me: () => api.get('/personal-trainers/me').then(r => r.data),
  create: (data: {
    name: string; email: string; password: string
    phone?: string; specialty?: string; bio?: string; planId?: string
  }) => api.post('/personal-trainers', data).then(r => r.data),
  update: (id: string, data: object) => api.put(`/personal-trainers/${id}`, data).then(r => r.data),
}

// Alunos
export const alunoApi = {
  list: () => api.get('/alunos').then(r => r.data),
  me: () => api.get('/alunos/me').then(r => r.data),
  myStudents: () => api.get('/alunos/my-students').then(r => r.data),
  create: (data: object) => api.post('/alunos', data).then(r => r.data),
}

// Plans
export const planApi = {
  list: () => api.get('/plans').then(r => r.data),
  create: (data: object) => api.post('/plans', data).then(r => r.data),
  update: (id: string, data: object) => api.put(`/plans/${id}`, data).then(r => r.data),
}

// Availability
export const availabilityApi = {
  mySlots: (startDate: string, endDate: string) =>
    api.get('/availability', { params: { startDate, endDate } }).then(r => r.data),
  ptSlots: (ptId: string, startDate: string, endDate: string) =>
    api.get(`/availability/pt/${ptId}`, { params: { startDate, endDate } }).then(r => r.data),
  create: (data: { startTime: string; endTime: string; maxAlunos?: number }) =>
    api.post('/availability', data).then(r => r.data),
  delete: (id: string) => api.delete(`/availability/${id}`),
  attendees: (id: string) => api.get(`/admin/schedule/${id}/attendees`).then(r => r.data),
}

// Admin schedule (admin allocates slots per PT)
export const adminScheduleApi = {
  list: (startDate: string, endDate: string) =>
    api.get('/admin/schedule', { params: { startDate, endDate } }).then(r => r.data),
  create: (data: { ptId: string; startTime: string; endTime: string; maxAlunos?: number }) =>
    api.post('/admin/schedule', data).then(r => r.data),
  delete: (id: string) => api.delete(`/admin/schedule/${id}`),
}

// Bookings
export const bookingApi = {
  myBookings: () => api.get('/bookings/my').then(r => r.data),
  create: (availabilityId: string) => api.post('/bookings', { availabilityId }).then(r => r.data),
  cancel: (id: string) => api.delete(`/bookings/${id}`),
}

// Billing
export const billingApi = {
  byMonth: (month?: string) => api.get('/billing', { params: month ? { month } : {} }).then(r => r.data),
}
