/** Shapes mirror the Laravel API resources (snake_case, decimals as strings). */

export type OrderStatus = 'preparing' | 'ready' | 'picked_up'

export interface OrderLine {
  id: number
  meal_id: number | null
  meal_name: string
  quantity: number
  unit_price: string
  line_total: string
  side_dishes: string[] | null
  note: string | null
}

export interface OrderCompany {
  id: number
  name: string
  code: string
}

export interface Order {
  id: number
  customer_first_name: string
  customer_last_name: string
  customer_phone: string
  arrival_time: string | null
  note: string | null
  payment_method: 'cash' | 'card'
  total_price: string
  company_id: number | null
  company?: OrderCompany | null
  pickup_code: string
  status: OrderStatus
  ready_at: string | null
  picked_up_at: string | null
  lines: OrderLine[]
  created_at: string | null
  updated_at: string | null
}

export interface Paginated<T> {
  data: T[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

export interface LoginResponse {
  token: string
  user: {
    id: number
    name: string
    email: string
    role: 'admin' | 'kitchen'
  }
}
