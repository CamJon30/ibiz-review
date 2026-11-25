import Tracker from "@/components/Tracker";
import AuthGate from "@/components/AuthGate";

export default function Home() {
  return (
    <main className="max-w-[540px] mx-auto px-4 pb-10">
      <AuthGate>
        <Tracker />
      </AuthGate>
    </main>
  );
}
