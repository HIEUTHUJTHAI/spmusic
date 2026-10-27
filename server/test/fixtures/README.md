# Copyright-free test fixture

`silence.mp3` is generated for this project, not downloaded or copied from a recording. It contains 40 MPEG-1 Layer III frames at 128 kb/s, 44.1 kHz, stereo, no padding. Each frame is 417 bytes with header `FF FB 90 00`; the remaining side information and data bytes are zero, representing silence. Duration is approximately 1.04 seconds. It contains no music, lyrics, performer recording or third-party metadata.

The integration test uploads it through the same endpoint as user MP3 files and checks the media response byte for byte. WAV test samples are generated as zero-valued PCM in the test source.
