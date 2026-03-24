export default function Dashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <a href="/linkedin" className="block bg-white rounded-lg border p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">in</div>
            <h2 className="text-lg font-semibold">LinkedIn Posts</h2>
          </div>
          <p className="text-gray-500 text-sm">Generate and schedule LinkedIn content for Angst+Pfister pages.</p>
        </a>

        <a href="/newsletter" className="block bg-white rounded-lg border p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">&#9993;</div>
            <h2 className="text-lg font-semibold">Newsletter</h2>
          </div>
          <p className="text-gray-500 text-sm">Create and manage Drive newsletter content for distribution.</p>
        </a>

      </div>
    </div>
  );
}
