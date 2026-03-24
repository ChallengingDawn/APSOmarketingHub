export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-apso-text mt-1">Your Innovation Development Partner</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <a href="/linkedin" className="block bg-white rounded-lg border border-apso-border p-6 hover:shadow-lg hover:border-apso-teal transition-all group">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-apso-teal rounded-lg flex items-center justify-center text-white font-bold text-sm">in</div>
            <h2 className="text-lg font-semibold text-apso-dark group-hover:text-apso-teal transition-colors">LinkedIn Posts</h2>
          </div>
          <p className="text-apso-text text-sm">Generate and schedule LinkedIn content for Angst+Pfister pages.</p>
        </a>

        <a href="/newsletter" className="block bg-white rounded-lg border border-apso-border p-6 hover:shadow-lg hover:border-apso-red transition-all group">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-apso-red rounded-lg flex items-center justify-center text-white font-bold text-lg">&#9993;</div>
            <h2 className="text-lg font-semibold text-apso-dark group-hover:text-apso-red transition-colors">Newsletter</h2>
          </div>
          <p className="text-apso-text text-sm">Create and manage Drive newsletter content for distribution.</p>
        </a>

      </div>
    </div>
  );
}
