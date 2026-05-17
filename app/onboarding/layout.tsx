export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] bg-black overflow-y-auto">
      {children}
    </div>
  )
}
