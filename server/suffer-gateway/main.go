package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	path := flag.String("config", "config.json", "JSON configuration file")
	check := flag.Bool("check-config", false, "validate configuration and print listen address without starting")
	flag.Parse()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if *check {
		c, err := loadConfig(*path)
		if err == nil {
			_, transport, validateErr := newGateway(c, logger)
			err = validateErr
			if transport != nil {
				transport.CloseIdleConnections()
			}
		}
		if err == nil {
			_, _, err = net.SplitHostPort(c.Listen)
		}
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		fmt.Println(c.Listen)
		return
	}
	if err := run(*path, logger); err != nil {
		logger.Error("gateway stopped", "error", err)
		os.Exit(1)
	}
}

func run(path string, logger *slog.Logger) error {
	c, err := loadConfig(path)
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}
	h, transport, err := newGateway(c, logger)
	if err != nil {
		return err
	}
	defer transport.CloseIdleConnections()
	listener, err := net.Listen("tcp", c.Listen)
	if err != nil {
		return err
	}
	server := &http.Server{Handler: h, ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 30 * time.Second, IdleTimeout: 90 * time.Second, MaxHeaderBytes: 1 << 20}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	done := make(chan error, 1)
	go func() { done <- server.Serve(listener) }()
	logger.Info("suffer-gateway ready", "listen", listener.Addr().String(), "endpoint", "/forward")
	select {
	case err := <-done:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdown); err != nil {
			server.Close()
			return err
		}
		return nil
	}
}
