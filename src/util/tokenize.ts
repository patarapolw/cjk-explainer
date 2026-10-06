import { DownloadingProps } from "./loading";

export function makeLinderaDownloadList(models: string[]): DownloadingProps[] {
  const version = "6.2.0";

  return models.map((model) => {
    const filepath = `lindera/lindera-${model}`;
    const zipFilename = `lindera-${model}-${version}.zip`;
    const url = `https://github.com/lindera/lindera/releases/download/v${version}/${zipFilename}`;

    return {
      filepath,
      zipFilename,
      zipOutdir: "lindera",
      url,
    };
  });
}
