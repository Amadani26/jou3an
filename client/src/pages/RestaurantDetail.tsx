import { useParams } from 'react-router-dom'

export default function RestaurantDetail() {
  const { id } = useParams<{ id: string }>()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6">
      <h1 className="font-display text-3xl font-bold text-text-primary">Restaurant</h1>
      <p className="text-text-secondary">Details for restaurant #{id}</p>
    </div>
  )
}
