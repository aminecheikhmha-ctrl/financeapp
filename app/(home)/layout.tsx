import Navbar from "@/app/components/Navbar"

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] bg-[#080808] overflow-y-auto">
      <Navbar />
      {children}
    </div>
  )
}
