package session

import (
	"archive/zip"
	"bytes"
	"fmt"
)

func BuildArchive(files map[string]string) ([]byte, error) {
	if len(files) == 0 {
		return nil, fmt.Errorf("no session files to archive")
	}

	var buffer bytes.Buffer
	zipWriter := zip.NewWriter(&buffer)
	for name, content := range files {
		writer, err := zipWriter.Create(name)
		if err != nil {
			_ = zipWriter.Close()
			return nil, err
		}
		if _, err = writer.Write([]byte(content)); err != nil {
			_ = zipWriter.Close()
			return nil, err
		}
	}

	if err := zipWriter.Close(); err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}
