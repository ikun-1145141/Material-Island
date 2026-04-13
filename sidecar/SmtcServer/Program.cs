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
        }
    }
});

string? lastMetaKey = null;
string? lastThumb   = null;
string  deviceName  = "";
string  deviceType  = "unknown";
int     tick           = 0;
int     noSessionCount = 0;

while (true)
{
    try
    {
        // 每 20 次（≈10s）刷新一次音频输出设备信息
        if (tick % 20 == 0)
            (deviceName, deviceType) = await GetAudioDeviceAsync();
        tick++;

        var manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
        var session = manager.GetCurrentSession();
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
                    position,
                    duration,
                    deviceName,
                    deviceType,
                }));
            }
            else if (statusStr == "playing")
            {
                // 元数据未变、仍在播放 → 仅推送进度
                // 若 position 和 duration 均为 0，说明 app 未上报 SMTC timeline，不发送，避免覆盖旧值
                if (position > 0 || duration > 0)
                {
                    stdout.WriteLine(JsonSerializer.Serialize(new
                    {
                        status = "position",
                        position,
                        duration,
                    }));
                }
            }
        }
    }
    catch (Exception ex)
    {
        stdout.WriteLine(JsonSerializer.Serialize(new { status = "error", message = ex.Message }));
    }

    await Task.Delay(500);
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
