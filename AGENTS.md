# 图整整项目约定

- 项目代码位于 `tidypic/`。
- 开发和本地生产预览地址固定为 `http://localhost:6001/`。
- 除非用户明确要求，不得改变端口，也不得通过命令行参数临时改用其他端口。
- 保持 Vite 的 `server.port` 和 `preview.port` 为 `6001`，两者 `strictPort` 均为 `true`。端口占用时检查现有服务，不自动换端口或终止无关进程。
