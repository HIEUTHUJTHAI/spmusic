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
    @State private var search = ""
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
        ZStack {
            LinearGradient(colors: [Color(red: 0.70, green: 0.79, blue: 0.96), Color(red: 0.86, green: 0.84, blue: 0.94), Color(red: 0.97, green: 0.87, blue: 0.92)], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
            Circle().fill(.white.opacity(0.35)).frame(width: 250).blur(radius: 40).offset(x: 160, y: -240).allowsHitTesting(false)
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    HStack(spacing: 11) {
                        if let url = Bundle.main.url(forResource: "spmusic-icon", withExtension: "png"), let image = UIImage(contentsOfFile: url.path) {
                            Image(uiImage: image).resizable().scaledToFill().frame(width: 42, height: 42).clipShape(RoundedRectangle(cornerRadius: 13))
                        } else { Text("SP").font(.headline).frame(width: 42, height: 42).background(.white.opacity(0.8), in: RoundedRectangle(cornerRadius: 13)) }
                        VStack(alignment: .leading, spacing: 1) { Text("SPMusic").font(.system(size: 24, weight: .heavy, design: .rounded)); Text("by HIEUTHUJTHAI").font(.system(size: 8, weight: .semibold)).tracking(0.9).opacity(0.65) }
                        Spacer()
                        Button { importing = true } label: { Image(systemName: "plus").font(.system(size: 18, weight: .semibold)).frame(width: 42, height: 42).background(.white.opacity(0.52), in: Circle()) }.accessibilityLabel("Thêm nhạc")
                    }
                    HStack(spacing: 11) { Image(systemName: "magnifyingglass"); TextField("Tìm bài hát của bạn...", text: $search).autocorrectionDisabled().textInputAutocapitalization(.never) }.font(.system(size: 14)).padding(.horizontal, 16).frame(height: 49).background(.white.opacity(0.5), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(.white.opacity(0.65)))
                    VStack(alignment: .leading, spacing: 7) {
                        Text("KHÔNG GIAN CỦA BẠN").font(.system(size: 9, weight: .bold)).tracking(2).opacity(0.55)
                        HStack(alignment: .lastTextBaseline) { Text("Thư viện nhạc").font(.system(size: 29, weight: .bold, design: .rounded)); Spacer(); Text("\(files.count) bài hát").font(.system(size: 12)).opacity(0.6) }
                        Text("Âm nhạc của bạn, theo cách của bạn.").font(.system(size: 13)).opacity(0.65)
                    }
                    if files.isEmpty {
                        VStack(spacing: 14) {
                            ZStack { RoundedRectangle(cornerRadius: 27).fill(LinearGradient(colors: [.init(red: 0.72, green: 0.80, blue: 0.98), .init(red: 0.86, green: 0.74, blue: 0.94)], startPoint: .topLeading, endPoint: .bottomTrailing)).frame(width: 100, height: 100).rotationEffect(.degrees(-7)); Image(systemName: "music.note.list").font(.system(size: 36, weight: .medium)) }.padding(.top, 12)
                            Text("Mang âm nhạc đến đây").font(.system(size: 19, weight: .bold, design: .rounded))
                            Text("Thư viện của bạn đang chờ bài hát đầu tiên. Thêm nhạc từ ứng dụng Tệp để nghe ngay.").font(.system(size: 13)).multilineTextAlignment(.center).opacity(0.65).lineSpacing(4).fixedSize(horizontal: false, vertical: true)
                            Button { importing = true } label: { Label("Thêm nhạc của bạn", systemImage: "plus").font(.system(size: 14, weight: .semibold)).padding(.horizontal, 20).padding(.vertical, 12).background(Color(red: 0.10, green: 0.15, blue: 0.25), in: RoundedRectangle(cornerRadius: 12)).foregroundStyle(.white) }
                        }.frame(maxWidth: .infinity).padding(.horizontal, 24).padding(.vertical, 30).background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 25)).overlay(RoundedRectangle(cornerRadius: 25).stroke(.white.opacity(0.65)))
                    } else {
                        let matches = search.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? files : files.filter { $0.lastPathComponent.localizedCaseInsensitiveContains(search) }
                        if matches.isEmpty { Text("Không tìm thấy bài hát phù hợp.").frame(maxWidth: .infinity).padding(30).background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 22)) }
                        else { VStack(spacing: 0) { ForEach(matches, id: \.self) { file in
                            Button { play(file) } label: { HStack(spacing: 12) {
                                Image(systemName: "waveform").font(.system(size: 18, weight: .bold)).frame(width: 46, height: 46).background(Color(red: 0.70, green: 0.65, blue: 0.94), in: RoundedRectangle(cornerRadius: 12))
                                VStack(alignment: .leading, spacing: 4) { Text(file.deletingPathExtension().lastPathComponent).font(.system(size: 14, weight: .semibold)).lineLimit(2).multilineTextAlignment(.leading); Text(file.pathExtension.uppercased() + " · TRÊN THIẾT BỊ").font(.system(size: 9, weight: .semibold)).opacity(0.6) }
                                Spacer(); Image(systemName: selected == file && playing ? "waveform" : "play.fill").font(.system(size: 13))
                            }.padding(13).contentShape(Rectangle()) }.buttonStyle(.plain)
                            if file != matches.last { Divider().padding(.leading, 71) }
                        } }.background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 22)).overlay(RoundedRectangle(cornerRadius: 22).stroke(.white.opacity(0.65))) }
                    }
                }.padding(.horizontal, 22).padding(.top, 16).padding(.bottom, 28)
            }
        }
        .foregroundStyle(Color(red: 0.10, green: 0.15, blue: 0.25)).tint(Color(red: 0.29, green: 0.42, blue: 0.72))
        .safeAreaInset(edge: .bottom, spacing: 0) {
            VStack(spacing: 10) {
                if let selected {
                    VStack(alignment: .leading, spacing: 5) {
                        HStack { Image(systemName: "waveform").font(.title3.bold()).frame(width: 43, height: 43).background(Color(red: 0.70, green: 0.65, blue: 0.94), in: RoundedRectangle(cornerRadius: 12)); VStack(alignment: .leading) { Text(selected.deletingPathExtension().lastPathComponent).font(.system(size: 13, weight: .semibold)).lineLimit(1); Text("Đang phát từ thư viện").font(.system(size: 10)).opacity(0.6) }; Spacer(); Button { if playing { player?.pause(); playing = false } else { playing = player?.play() ?? false } } label: { Image(systemName: playing ? "pause.fill" : "play.fill").font(.system(size: 17)).frame(width: 38, height: 38).background(Color(red: 0.10, green: 0.15, blue: 0.25), in: Circle()).foregroundStyle(.white) }.accessibilityLabel(playing ? "Tạm dừng" : "Phát") }
                        HStack { Text("\(Int(current) / 60):\(String(format: "%02d", Int(current) % 60))"); Slider(value: Binding(get: { min(current, max(duration, 0.01)) }, set: { current = $0; player?.currentTime = $0 }), in: 0...max(duration, 0.01)).accessibilityLabel("Tua nhạc"); Text("\(Int(duration) / 60):\(String(format: "%02d", Int(duration) % 60))") }.font(.system(size: 9)).monospacedDigit()
                    }.padding(13).background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20)).overlay(RoundedRectangle(cornerRadius: 20).stroke(.white.opacity(0.7)))
                }
                Button { importing = true } label: { Label("Thêm nhạc", systemImage: "plus").font(.system(size: 14, weight: .semibold)).frame(maxWidth: .infinity).frame(height: 46).background(.white.opacity(0.57), in: RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(.white.opacity(0.7))) }
            }.padding(.horizontal, 22).padding(.top, 10).padding(.bottom, 8).background(.ultraThinMaterial)
        }
        .preferredColorScheme(.light).onAppear(perform: refresh)
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
    }
}
