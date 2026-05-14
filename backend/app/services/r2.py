from dataclasses import dataclass


@dataclass
class R2Service:
    public_base_url: str = "https://audio.lisboaporoutros.com"

    def upload_audio(self, key: str, content: bytes) -> str:
        _ = content
        return f"{self.public_base_url}/{key.removeprefix('audio/')}"

    def delete_audio(self, key: str) -> None:
        _ = key
