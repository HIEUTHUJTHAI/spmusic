import SwiftUI
import AVFoundation
import UniformTypeIdentifiers

@main
struct SPMusicIOSApp: App {
    var body: some Scene { WindowGroup { MusicView() } }
}

struct MusicView: View {
    @State private var files: [URL] = []
    @State private var selected: URL?
    @State private var player: AVAudioPlayer?
    @State private var playing = false
    @State private var importing = false
    @State private var error: String?
    @State private var current: Double = 0
    @State private var duration: Double = 0
    private let timer = Timer.publish(every: 0.25, on: .main, in: .common).autoconnect()
    private var library: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("Music", isDirectory: true)
    }
    private func refresh() {
        do {
            try FileManager.default.createDirectory(at: library, withIntermediateDirectories: true)
            files = try FileManager.default.contentsOfDirectory(at: library, includingPropertiesForKeys: nil).filter { ["mp3", "wav", "m4a", "aac", "aiff"].contains($0.pathExtension.lowercased()) }.sorted { $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedAscending }
        } catch { self.error = "Không thể mở thư viện nhạc." }
    }
    private func play(_ url: URL) {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
            let next = try AVAudioPlayer(contentsOf: url)
            next.prepareToPlay()
            guard next.play() else { throw NSError(domain: "SPMusic", code: 1) }
            player = next; selected = url; playing = true; duration = next.duration; current = 0
        } catch { self.error = "Không thể phát file này trên iPhone." }
    }
    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                if files.isEmpty { Spacer(); Text("Thư viện còn trống").font(.title2.bold()); Text("Thêm file nhạc của bạn để bắt đầu.").foregroundStyle(.secondary); Spacer() }
                else { List(files, id: \.self) { file in Button { play(file) } label: { HStack { Image(systemName: selected == file && playing ? "waveform" : "music.note"); Text(file.deletingPathExtension().lastPathComponent).lineLimit(2); Spacer(); Image(systemName: "play.fill") } } } }
                if let selected {
                    VStack(alignment: .leading) {
                        Text(selected.deletingPathExtension().lastPathComponent).font(.headline).lineLimit(1)
                        Slider(value: Binding(get: { min(current, max(duration, 0.01)) }, set: { current = $0; player?.currentTime = $0 }), in: 0...max(duration, 0.01))
                        HStack { Text("\(Int(current) / 60):\(String(format: "%02d", Int(current) % 60))"); Spacer(); Button { if playing { player?.pause(); playing = false } else { playing = player?.play() ?? false } } label: { Image(systemName: playing ? "pause.fill" : "play.fill").font(.title) }; Spacer(); Text("\(Int(duration) / 60):\(String(format: "%02d", Int(duration) % 60))") }.font(.caption)
                    }.padding().background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20))
                }
                Button { importing = true } label: { Label("Thêm nhạc", systemImage: "plus").frame(maxWidth: .infinity).padding().background(.pink, in: RoundedRectangle(cornerRadius: 14)).foregroundStyle(.white) }
            }.padding().navigationTitle("SPMusic").onAppear(perform: refresh)
                .onReceive(timer) { _ in if let p = player { current = p.currentTime; if playing && !p.isPlaying { playing = false } } }
                .fileImporter(isPresented: $importing, allowedContentTypes: [.audio], allowsMultipleSelection: true) { result in
                    do {
                        let urls = try result.get()
                        try FileManager.default.createDirectory(at: library, withIntermediateDirectories: true)
                        for url in urls {
                            let access = url.startAccessingSecurityScopedResource()
                            defer { if access { url.stopAccessingSecurityScopedResource() } }
                            let destination = library.appendingPathComponent(url.lastPathComponent)
                            if !FileManager.default.fileExists(atPath: destination.path) { try FileManager.default.copyItem(at: url, to: destination) }
                        }
                        refresh()
                    } catch { self.error = "Không thể thêm file. Hãy thử lại trong ứng dụng Tệp." }
                }
                .alert("SPMusic", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("OK", role: .cancel) { error = nil } } message: { Text(error ?? "") }
        }.tint(.pink)
    }
}
