using System.Text;
using System.Text.Json;
using Windows.Devices.Enumeration;
using Windows.Media.Control;
using Windows.Media.Devices;
using Windows.Storage.Streams;

// 确保 stdout 不缓冲，父进程能逐行读取
using var stdout = new StreamWriter(
    Console.OpenStandardOutput(),
    new UTF8Encoding(encoderShouldEmitUTF8Identifier: false),
    bufferSize: 1,
    leaveOpen: true
);
stdout.AutoFlush = true;

// 共享当前会话，供控制命令使用
GlobalSystemMediaTransportControlsSession? currentSession = null;

// 后台读取 stdin：每行一条控制命令（prev / next / toggle）
_ = Task.Run(async () =>
{
    while (true)
    {
        var line = Console.ReadLine();
        if (line is null) break;
        var session = currentSession;
        if (session is null) continue;
        switch (line.Trim())
        {
            case "prev":   await session.TrySkipPreviousAsync();    break;
            case "next":   await session.TrySkipNextAsync();        break;
            case "toggle": await session.TryTogglePlayPauseAsync(); break;
            default:
                if (line.StartsWith("seek:") && double.TryParse(
                        line.AsSpan(5), System.Globalization.NumberStyles.Float,
                        System.Globalization.CultureInfo.InvariantCulture, out var secs))
                {
                    // SMTC 使用 100 纳秒单位（TimeSpan ticks）
                    var ticks = (long)(secs * 10_000_000);
                    await session.TryChangePlaybackPositionAsync(ticks);
                }
                break;
        }
    }
});

string? lastMetaKey = null;
string? lastThumb   = null;
string  deviceName  = "";
string  deviceType  = "unknown";
int     tick           = 0;
int     noSessionCount = 0;

// 订阅 SessionsChanged 事件，触发立即更新（与 WinIsland 相同）
bool sessionChangedFlag = false;
var manager0 = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
manager0.SessionsChanged += (_, _) => { sessionChangedFlag = true; };

// WinIsland 风格本地播放计时器
// 核心思路：以本地时钟为准，SMTC 只作校准参考（> 3s 漂移才 resync）
// 这样即使酷狗等 App 始终上报 position=0，进度条也能正确累进
string          _prevStatus   = "";
string          _prevSongKey  = "";
double          _basePos      = 0.0;      // 上次确认的播放位置（秒）
DateTimeOffset  _baseTime     = DateTimeOffset.MinValue;  // _basePos 对应的本地时刻
double          _cachedDur    = 0.0;      // 缓存有效时长（某些 App 只在曲目开始时上报一次）

while (true)
{
    try
    {
        // 每 20 次（≈10s）刷新一次音频输出设备信息
        if (tick % 20 == 0)
            (deviceName, deviceType) = await GetAudioDeviceAsync();
        tick++;

        var manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
        // WinIsland 风格：遍历所有 session，优先选正在播放的音乐 session
        var session = GetBestMusicSession(manager);
        currentSession = session;

        if (session is null)
        {
            noSessionCount++;
            // 需连续 4 次（≈2s）无会话才发出 no_session，避免换曲间随瞬抚闪
            if (noSessionCount >= 4 && lastMetaKey != "no_session")
            {
                lastMetaKey = "no_session";
                lastThumb   = null;
                stdout.WriteLine(JsonSerializer.Serialize(new { status = "no_session" }));
            }
        }
        else
        {
            noSessionCount = 0; // 恢复会话，重置计数器
            var props     = await session.TryGetMediaPropertiesAsync();
            var pbInfo    = session.GetPlaybackInfo();
            var timeline  = session.GetTimelineProperties();
            var statusStr = MapStatus(pbInfo.PlaybackStatus);

            // EndTime 是歌曲总时长；部分应用（如酷狗）不填 EndTime，尝试 MaxSeekTime 备选
            double duration = timeline.EndTime.TotalSeconds > 0
                ? timeline.EndTime.TotalSeconds
                : timeline.MaxSeekTime.TotalSeconds;

            // Position 是 LastUpdatedTime 时刻的快照，需补偿已流逝时间
            // 防御：LastUpdatedTime 异常（MinValue 或远古/未来）时 elapsed 置 0
            var elapsed = 0.0;
            if (statusStr == "playing" && timeline.LastUpdatedTime != DateTimeOffset.MinValue)
            {
                var sinceUpdate = (DateTimeOffset.Now - timeline.LastUpdatedTime).TotalSeconds;
                // 0~3600s 内视为有效补偿，否则认为 app 未上报真实时间戳
                if (sinceUpdate >= 0 && sinceUpdate <= 3600)
                    elapsed = sinceUpdate;
            }

            double position = Math.Max(0, timeline.Position.TotalSeconds + elapsed);
            if (duration > 0) position = Math.Min(position, duration);

            // 解析播放来源应用名称
            var sourceId = session.SourceAppUserModelId ?? "";
            var source   = ParseSourceName(sourceId);

            // ── WinIsland 风格本地计时器 ────────────────────────────────
            // 许多 App（如酷狗）始终通过 SMTC 上报 position=0，这里用本地时钟填补。
            var thisSongKey = $"{props.Title}|{props.Artist}";
            if (thisSongKey != _prevSongKey)
            {
                // 曲目切换：重置计时器
                _prevSongKey = thisSongKey;
                _basePos     = 0.0;
                _baseTime    = DateTimeOffset.MinValue;
            }

            // 缓存有效时长
            if (duration > 0) _cachedDur = duration;
            var outDuration = _cachedDur > 0 ? _cachedDur : duration;

            double outPosition;
            var nowPlaying = statusStr == "playing";
            var wasPlaying = _prevStatus == "playing";

            if (nowPlaying)
            {
                if (!wasPlaying || _baseTime == DateTimeOffset.MinValue)
                {
                    // 初始 / 恢复播放：SMTC 有效时用作基准，否则保持上一次冒冻的位置
                    if (position > 1.0) _basePos = position;
                    _baseTime = DateTimeOffset.Now;
                }
                else if (position > 1.0)
                {
                    // 播放中：SMTC 给出有效值，樼测是否发生 seek
                    var ours = _basePos + (DateTimeOffset.Now - _baseTime).TotalSeconds;
                    if (Math.Abs(position - ours) > 3.0)
                    {
                        // 差距 > 3s 认定是 seek，同步到 SMTC
                        _basePos  = position;
                        _baseTime = DateTimeOffset.Now;
                    }
                }
                outPosition = _basePos + (DateTimeOffset.Now - _baseTime).TotalSeconds;
                if (outDuration > 0) outPosition = Math.Min(outPosition, outDuration);
                outPosition = Math.Max(0, outPosition);
            }
            else
            {
                // 暂停 / 停止
                if (wasPlaying)
                {
                    // 刚刚暂停：将计时器动能冒冻进 _basePos
                    if (_baseTime != DateTimeOffset.MinValue)
                        _basePos = _basePos + (DateTimeOffset.Now - _baseTime).TotalSeconds;
                    _baseTime = DateTimeOffset.MinValue;
                }
                // SMTC 有效位置优先（例如暂停时用户 seek）
                if (position > 0) _basePos = position;
                outPosition = _basePos;
            }

            _prevStatus = statusStr;
            // 以局部插値值替换原始 SMTC 位置，居下代码统一使用 outPosition / outDuration
            // ────────────────────────────────────────────────────────────────────

            var metaKey = $"{props.Title}|{props.Artist}|{statusStr}";

            if (metaKey != lastMetaKey)
            {
                lastMetaKey = metaKey;

                string? thumb = null;
                if (props.Thumbnail is not null)
                {
                    try
                    {
                        using var stream = await props.Thumbnail.OpenReadAsync();
                        var size   = (uint)Math.Min(stream.Size, 1024 * 800);
                        using var reader = new DataReader(stream.GetInputStreamAt(0));
                        await reader.LoadAsync(size);
                        var bytes = new byte[size];
                        reader.ReadBytes(bytes);
                        thumb     = Convert.ToBase64String(bytes);
                        lastThumb = thumb;
                    }
                    catch { thumb = lastThumb; }
                }
                else
                {
                    lastThumb = null;
                }

                stdout.WriteLine(JsonSerializer.Serialize(new
                {
                    status     = "ok",
                    title      = props.Title      ?? "",
                    artist     = props.Artist     ?? "",
                    album      = props.AlbumTitle ?? "",
                    playback   = statusStr,
                    source,
                    thumb      = lastThumb,
                    position   = outPosition,
                    duration   = outDuration,
                    deviceName,
                    deviceType,
                }));
            }
            else if (statusStr == "playing")
            {
                // 元数据未变、仍在播放 → 仅推送进度
                // 本地计时器始终能给出 > 0 的 outPosition，不再需要过滤
                stdout.WriteLine(JsonSerializer.Serialize(new
                {
                    status   = "position",
                    position = outPosition,
                    duration = outDuration,
                }));
            }
        }
    }
    catch (Exception ex)
    {
        stdout.WriteLine(JsonSerializer.Serialize(new { status = "error", message = ex.Message }));
    }

    // WinIsland 使用 300ms 轮询；若 SessionsChanged 已触发则立即执行
    if (!sessionChangedFlag)
        await Task.Delay(300);
    sessionChangedFlag = false;
}

// WinIsland 风格：遍历所有 SMTC session，优先选 Playing 的音乐 session
static GlobalSystemMediaTransportControlsSession? GetBestMusicSession(
    GlobalSystemMediaTransportControlsSessionManager manager)
{
    GlobalSystemMediaTransportControlsSession? fallback = null;
    try
    {
        var sessions = manager.GetSessions();
        foreach (var s in sessions)
        {
            // 跳过视频类型（与 WinIsland is_music_session 等价）
            try
            {
                var pbInfo = s.GetPlaybackInfo();
                var pt = pbInfo.PlaybackType;
                if (pt != null && pt.Value == Windows.Media.MediaPlaybackType.Video)
                    continue;
                if (pbInfo.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing)
                    return s;   // 找到正在播放的音乐 session，立即返回
                fallback ??= s; // 记录非 Playing 的备选
            }
            catch { /* 跳过无法访问的 session */ }
        }
    }
    catch { /* GetSessions 失败时回退 */ }
    // 没有 Playing session → 用备选；备选也没有 → 用系统当前 session
    return fallback ?? manager.GetCurrentSession();
}

static string MapStatus(GlobalSystemMediaTransportControlsSessionPlaybackStatus s) => s switch
{
    GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing  => "playing",
    GlobalSystemMediaTransportControlsSessionPlaybackStatus.Paused   => "paused",
    GlobalSystemMediaTransportControlsSessionPlaybackStatus.Stopped  => "stopped",
    _                                                                 => "unknown",
};

static string ParseSourceName(string sourceId)
{
    if (string.IsNullOrEmpty(sourceId)) return "";
    if (sourceId.Contains('\\'))
        return Path.GetFileNameWithoutExtension(sourceId);
    if (sourceId.Contains('!'))
    {
        var appId = sourceId.Split('!')[0];
        var parts = appId.Split('.');
        return parts.Length > 1 ? parts[^1].Split('_')[0] : appId;
    }
    return sourceId;
}

static async Task<(string name, string type)> GetAudioDeviceAsync()
{
    try
    {
        var deviceId   = MediaDevice.GetDefaultAudioRenderId(AudioDeviceRole.Default);
        var deviceInfo = await DeviceInformation.CreateFromIdAsync(deviceId);
        var name       = deviceInfo.Name;
        var lower      = name.ToLowerInvariant();
        var isHeadphone = lower.Contains("headphone") || lower.Contains("headset")
                       || lower.Contains("earphone")  || lower.Contains("earbuds")
                       || lower.Contains("airpods")   || lower.Contains("耳机")
                       || lower.Contains("耳麦");
        return (name, isHeadphone ? "headphone" : "speaker");
    }
    catch
    {
        return ("", "unknown");
    }
}
