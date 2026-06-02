import Navbar from "@/app/components/Navbar"

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] bg-transparent overflow-y-auto">
      <Navbar />
      {children}
    </div>
  )
}
