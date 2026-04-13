using System.Text;
using System.Text.Json;
using Windows.Media.Control;
using Windows.Storage.Streams;

// 确保 stdout 不缓冲，父进程能逐行读取
using var stdout = new StreamWriter(
    Console.OpenStandardOutput(),
    new UTF8Encoding(encoderShouldEmitUTF8Identifier: false),
    bufferSize: 1,
    leaveOpen: true
);
stdout.AutoFlush = true;

string? lastKey = null;

while (true)
{
    try
    {
        var manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
        var session = manager.GetCurrentSession();

        if (session is null)
        {
            if (lastKey != "no_session")
            {
                lastKey = "no_session";
                stdout.WriteLine(JsonSerializer.Serialize(new { status = "no_session" }));
            }
        }
        else
        {
            var props   = await session.TryGetMediaPropertiesAsync();
            var pstatus = session.GetPlaybackInfo().PlaybackStatus;
            var status  = MapStatus(pstatus);
            var key     = $"{props.Title}|{props.Artist}|{status}";

            // 只有内容变化时才输出（减少无效 IPC）
            if (key != lastKey)
            {
                lastKey = key;

                string? thumb = null;
                if (props.Thumbnail is not null)
                {
                    try
                    {
                        using var stream = await props.Thumbnail.OpenReadAsync();
                        var size   = (uint)Math.Min(stream.Size, 1024 * 800); // 上限 800 KB
                        using var reader = new DataReader(stream.GetInputStreamAt(0));
                        await reader.LoadAsync(size);
                        var bytes = new byte[size];
                        reader.ReadBytes(bytes);
                        thumb = Convert.ToBase64String(bytes);
                    }
                    catch { /* 封面读取失败不影响主流程 */ }
                }

                var result = new
                {
                    status  = "ok",
                    title   = props.Title        ?? "",
                    artist  = props.Artist       ?? "",
                    album   = props.AlbumTitle   ?? "",
                    playback = status,
                    thumb,
                };

                stdout.WriteLine(JsonSerializer.Serialize(result));
            }
        }
    }
    catch (Exception ex)
    {
        stdout.WriteLine(JsonSerializer.Serialize(new { status = "error", message = ex.Message }));
    }

    await Task.Delay(2000);
}

static string MapStatus(GlobalSystemMediaTransportControlsSessionPlaybackStatus s) => s switch
{
    GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing  => "playing",
    GlobalSystemMediaTransportControlsSessionPlaybackStatus.Paused   => "paused",
    GlobalSystemMediaTransportControlsSessionPlaybackStatus.Stopped  => "stopped",
    _                                                                 => "unknown",
};
